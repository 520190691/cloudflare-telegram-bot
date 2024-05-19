require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Use environment variables
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
let cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

// Utility function to set Cloudflare headers
const getCloudflareHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
});

// Function to get Cloudflare nameservers for a domain
const getNameservers = async (domain) => {
    try {
        const response = await axios.get(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        const zone = response.data.result[0];
        return zone.name_servers;
    } catch (error) {
        throw new Error('Failed to fetch nameservers');
    }
};

// Function to check domain status
const getDomainStatus = async (domain) => {
    try {
        const response = await axios.get(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        const zone = response.data.result[0];
        return zone.status;
    } catch (error) {
        throw new Error('Failed to fetch domain status');
    }
};

// Function to list domains in Cloudflare account
const listDomains = async () => {
    try {
        const response = await axios.get('https://api.cloudflare.com/client/v4/zones', {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        return response.data.result.map(zone => zone.name);
    } catch (error) {
        throw new Error('Failed to list domains');
    }
};

// Function to delete a domain
const deleteDomain = async (domain) => {
    try {
        const response = await axios.get(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        const zone = response.data.result[0];
        await axios.delete(`https://api.cloudflare.com/client/v4/zones/${zone.id}`, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        return true;
    } catch (error) {
        throw new Error('Failed to delete domain');
    }
};

// Initialize the bot
const bot = new TelegramBot(telegramBotToken, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to the Cloudflare Bot! Please provide your Cloudflare API token.');
});

// Handle API token input
bot.onText(/\/settoken (.+)/, (msg, match) => {
    cloudflareApiToken = match[1];
    bot.sendMessage(msg.chat.id, 'Cloudflare API token set successfully!');
});

// Handle /add command
bot.onText(/\/add (.+)/, async (msg, match) => {
    const domain = match[1];
    try {
        const nameservers = await getNameservers(domain);
        bot.sendMessage(msg.chat.id, `Nameservers for ${domain}: ${nameservers.join(', ')}`);

        // Additional configuration steps...
        bot.sendMessage(msg.chat.id, 'Configuring additional settings...');
        // Add configuration code here...

        bot.sendMessage(msg.chat.id, 'Domain added and configured successfully!');
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
    }
});

// Handle /cfstatus command
bot.onText(/\/cfstatus (.+)/, async (msg, match) => {
    const domain = match[1];
    try {
        const status = await getDomainStatus(domain);
        bot.sendMessage(msg.chat.id, `Status of ${domain}: ${status}`);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
    }
});

// Handle /sites command
bot.onText(/\/sites/, async (msg) => {
    try {
        const domains = await listDomains();
        bot.sendMessage(msg.chat.id, `Your domains: ${domains.join(', ')}`);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
    }
});

// Handle /delete command
bot.onText(/\/delete (.+)/, async (msg, match) => {
    const domain = match[1];
    try {
        await deleteDomain(domain);
        bot.sendMessage(msg.chat.id, `${domain} deleted successfully!`);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
    }
});
