const { REST, Routes } = require('discord.js');
const { ApplicationCommandOptionType } = require('discord-api-types/v10');

const TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = '1482276856257314958';

const commands = [
    {
        name: 'conflict',
        description: 'Conflict Globe commands',
        options: [
            {
                name: 'status',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Check Conflict Globe status'
            },
            {
                name: 'news',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Get latest world news'
            },
            {
                name: 'data',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Get latest conflict events from local API'
            },
            {
                name: 'testpush',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Test scheduled push (manual trigger)'
            },
            {
                name: 'threats',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Show critical threats detected'
            },
            {
                name: 'profiles',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Show threat profiles'
            },
            {
                name: 'report',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Generate threat analysis report'
            },
            {
                name: 'analyze',
                type: ApplicationCommandOptionType.Subcommand,
                description: 'Analyze new events and update profiles'
            }
        ]
    },
    {
        name: 'ping',
        description: 'Test if bot is responding'
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Register for all guilds (global commands take up to 1 hour to propagate)
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
