const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
// Pega todos os arquivos de comando do diretório commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

// Constrói e prepara uma instância do módulo REST
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy dos comandos globalmente
(async () => {
    try {
        console.log(`Iniciando o refresh de ${commands.length} comandos (/) globalmente.`);

        // O método put é usado para atualizar todos os comandos globalmente
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Sucesso! ${data.length} comandos foram registrados globalmente.`);
    } catch (error) {
        console.error('Erro ao registrar os comandos:', error);
    }
})();
