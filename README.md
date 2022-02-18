# choochbot-premium

Instructions for Ryan/Danny:

1. Clone this repository from github. See instructions:
https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository

2. Install NodeJS and NPM (node package manager) if not installed. See instructions:
https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

3. Run 'npm install' in the working directory. This installs your dependencies. 

4. To run choochbot, run the following command in a terminal. Change the WALLET and ENDPOINT values to reflect
the address of the ethermine wallet and the discord endpoint you want to hit. Discord endpoint can be found
in our server settings.

WALLET=0x123456... ENDPOINT=https://discord.com/api/webhooks/ node index.js

5. To run it regularly, use a cron job on linux or a scheduled task on Windows. I can help you with setting up a
cron job but you'll have to ask Kyle or someone how to set it up on Windows.