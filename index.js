const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot has arrived');
});

app.listen(8000, () => {
  console.log('Server started');
});

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   let pendingPromise = Promise.resolve();

function detectAuthType() {
    return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
            reject("Auth detection timed out. No login/register prompt received.");
        }, 7000);

        const listener = (jsonMsg) => {
            const msg = jsonMsg.toString().toLowerCase();
            console.log("[AuthDetect]", msg);

            // REGISTER prompts
            if (
                msg.includes("/register") ||
                msg.includes("please register") ||
                msg.includes("you are not registered") ||
                msg.includes("prosím zaregistruj se") ||
                msg.includes("zaregistruj se")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                resolve("register");
            }

            // LOGIN prompts
            if (
                msg.includes("/login") ||
                msg.includes("please login") ||
                msg.includes("you need to login") ||
                msg.includes("prosím přihlaš se") ||
                msg.includes("přihlas se")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                resolve("login");
            }
        };

        bot.on("message", listener);
    });
}

  
function sendRegister(password) {
    return waitForAuthResponse("register", password);
}

function sendLogin(password) {
    return waitForAuthResponse("login", password);
}
  
function waitForAuthResponse(type, password) {
    return new Promise((resolve, reject) => {

        let timeout = setTimeout(() => {
            reject(`[Auth] No response from server after sending /${type}.`);
        }, 7000);

        const listener = (jsonMsg) => {
            const msg = jsonMsg.toString().toLowerCase();
            console.log(`[AuthLog] ${msg}`);

            // Detect success
            if (
                msg.includes("successfully logged in") ||
                msg.includes("login successful") ||
                msg.includes("authenticated") ||
                msg.includes("welcome") ||
                msg.includes("logged in")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                console.log(`[Auth] ${type} success detected.`);
                resolve();
            }

            // Detect already registered
            if (
                msg.includes("already registered") ||
                msg.includes("already logged in")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                console.log(`[Auth] ${type} already registered/logged in.`);
                resolve();
            }

            // Detect errors
            if (
                msg.includes("invalid password") ||
                msg.includes("wrong password") ||
                msg.includes("incorrect password")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                reject(`[Auth] Wrong password.`);
            }

            if (
                msg.includes("not registered") ||
                msg.includes("please register")
            ) {
                clearTimeout(timeout);
                bot.removeListener("message", listener);
                reject(`[Auth] Account is not registered.`);
            }
        };

        bot.on("message", listener);

        // Send the command
        if (type === "register") {
            bot.chat(`/register ${password} ${password}`);
            console.log("[Auth] Sent /register command.");
        } else {
            bot.chat(`/login ${password}`);
            console.log("[Auth] Sent /login command.");
        }
    });
}
   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server', '\x1b[0m');

if (config.utils['auto-auth'].enabled) {
          console.log('[INFO] Started auto-auth module');

          const password = config.utils['auto-auth'].password;

          pendingPromise = pendingPromise
              .then(async () => {
                  console.log('[Auth] Waiting for auth prompt...');

                  const authType = await detectAuthType();
                  console.log(`[Auth] Server requires: ${authType}`);

                  if (authType === "register") {
                      await sendRegister(password);
                      return sendLogin(password); // login po registraci
                  }

                  if (authType === "login") {
                      return sendLogin(password);
                  }

                  throw new Error("Auth type could not be detected.");
              })
              .catch(error => console.error('[ERROR]', error));
      }

      bot.on("message", (jsonMsg, position, sender) => {
          const msg = jsonMsg.toString();
          console.log(`[Chat] ${msg}`);
      });

     
      if (config.utils['chat-messages'].enabled) {
         console.log('[INFO] Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            let msg_timer = setInterval(() => {
               bot.chat(`${messages[i]}`);

               if (i + 1 === messages.length) {
                  i = 0;
               } else {
                  i++;
               }
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      const pos = config.position;

      if (config.position.enabled) {
         console.log(
            `\x1b[32m[Afk Bot] Starting to move to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`
         );
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         bot.setControlState('jump', true);
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }
      }
   });

   bot.on('goal_reached', () => {
      console.log(
         `\x1b[32m[AfkBot] Bot arrived at the target location. ${bot.entity.position}\x1b[0m`
      );
   });

   bot.on('death', () => {
      console.log(
         `\x1b[33m[AfkBot] Bot has died and was respawned at ${bot.entity.position}`,
         '\x1b[0m'
      );
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => {
            createBot();
         }, config.utils['auto-recconect-delay']);
      });
   }

   bot.on('kicked', (reason) =>
      console.log(
         '\x1b[33m',
         `[AfkBot] Bot was kicked from the server. Reason: \n${reason}`,
         '\x1b[0m'
      )
   );

   bot.on('error', (err) =>
      console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m')
   );
}

createBot();
