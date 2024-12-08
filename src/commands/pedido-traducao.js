const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

class UserDataManager {
    constructor(filename = 'user_data.json') {
        this.dataPath = path.join(__dirname, '..', 'data', filename);
        if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'data'));
        }
        this.data = this.loadData();
    }

    loadData() {
        try {
            return fs.existsSync(this.dataPath) ? JSON.parse(fs.readFileSync(this.dataPath, 'utf8')) : {};
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            return {};
        }
    }

    saveData() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }

    getUserData(userId) {
        return this.data[userId] || { translationRequests: [], cooldowns: {} };
    }

    resetCooldown(userId, commandName) {
        const userData = this.getUserData(userId);
        if (userData.cooldowns[commandName]) {
            delete userData.cooldowns[commandName];
            this.data[userId] = userData;
            this.saveData();
            return true;
        }
        return false;
    }

    checkAndSetCooldown(userId, commandName, cooldownTime) {
        const userData = this.getUserData(userId);
        const currentTime = Date.now();

        if (userData.cooldowns[commandName]) {
            const timeLeft = userData.cooldowns[commandName] - currentTime;
            if (timeLeft > 0) return { onCooldown: true, timeLeft };
        }

        userData.cooldowns[commandName] = currentTime + cooldownTime;
        this.data[userId] = userData;
        this.saveData();
        return { onCooldown: false, timeLeft: 0 };
    }

    addTranslationRequest(userId, requestData) {
        const userData = this.getUserData(userId);
        userData.translationRequests.push({ ...requestData, timestamp: Date.now() });
        if (userData.translationRequests.length > 10) userData.translationRequests.shift();
        this.data[userId] = userData;
        this.saveData();
    }
}

const COOLDOWN_TIME = 3600000; // 1 hora

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pedido-traducao')
        .setDescription('Sistema de pedidos de tradução')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.SendMessages |
            PermissionFlagsBits.EmbedLinks |
            PermissionFlagsBits.AttachFiles
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('criar')
                .setDescription('Criar um novo pedido de tradução'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resetar')
                .setDescription('Resetar o cooldown de um usuário (apenas staff)')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para resetar o cooldown')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            // Verificar se é o servidor correto
            if (interaction.guildId !== '966183700272398346') {
                return interaction.reply({
                    content: '❌ Este comando só pode ser usado no servidor 18Games.',
                    ephemeral: true
                });
            }

            // Verificar permissões básicas
            const channel = interaction.channel;
            const permissions = channel.permissionsFor(interaction.client.user);
            
            if (!permissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles
            ])) {
                return interaction.reply({
                    content: '❌ O bot não tem as permissões necessárias neste canal. Por favor, verifique as permissões.',
                    ephemeral: true
                });
            }

            const userDataManager = new UserDataManager();

            if (interaction.options.getSubcommand() === 'resetar') {
                if (!interaction.member.permissions.has('ManageMessages')) {
                    return interaction.reply({
                        content: '❌ Você não tem permissão para resetar cooldowns.',
                        ephemeral: true
                    });
                }

                const targetUser = interaction.options.getUser('usuario');
                const wasReset = userDataManager.resetCooldown(targetUser.id, 'pedido-traducao');

                return interaction.reply({
                    content: wasReset 
                        ? `✅ Cooldown de ${targetUser.tag} foi resetado com sucesso!`
                        : `ℹ️ ${targetUser.tag} não tinha cooldown ativo.`,
                    ephemeral: true
                });
            }

            // Comando criar
            const cooldownResult = userDataManager.checkAndSetCooldown(
                interaction.user.id, 
                'pedido-traducao', 
                COOLDOWN_TIME
            );

            if (cooldownResult.onCooldown) {
                const hoursLeft = Math.floor(cooldownResult.timeLeft / 3600000);
                const minutesLeft = Math.floor((cooldownResult.timeLeft % 3600000) / 60000);
                const secondsLeft = Math.floor((cooldownResult.timeLeft % 60000) / 1000);

                return interaction.reply({
                    content: `⏰ Você precisa esperar ${hoursLeft}h ${minutesLeft}m ${secondsLeft}s para fazer outro pedido.`,
                    ephemeral: true
                });
            }

            console.log('Iniciando coleta de dados do pedido...');
            await interaction.reply('Por favor, digite o nome do jogo:');
            
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 60000 });
            
            let gameData = {
                name: '',
                engine: '',
                link: ''
            };
            
            let step = 0;
            
            collector.on('collect', async (message) => {
                try {
                    console.log(`Coletando passo ${step}: ${message.content}`);
                    switch(step) {
                        case 0:
                            gameData.name = message.content;
                            await interaction.followUp('Qual a engine do jogo?');
                            step++;
                            break;
                        case 1:
                            gameData.engine = message.content;
                            await interaction.followUp('Qual o link do jogo?');
                            step++;
                            break;
                        case 2:
                            gameData.link = message.content;
                            collector.stop();
                            
                            console.log('Criando embed do pedido...');
                            const embed = new EmbedBuilder()
                                .setTitle('📝 Pedido de Tradução')
                                .setColor('#3498db')
                                .addFields(
                                    { name: 'Nome do Jogo', value: gameData.name },
                                    { name: 'Engine', value: gameData.engine },
                                    { name: 'Link', value: `[Clique aqui para acessar](${gameData.link})` }
                                )
                                .setThumbnail(interaction.user.displayAvatarURL())
                                .setFooter({ 
                                    text: `Pedido feito por ${interaction.user.tag}`, 
                                    iconURL: interaction.user.displayAvatarURL() 
                                })
                                .setTimestamp();

                            const button = new ButtonBuilder()
                                .setCustomId('accept_translation')
                                .setLabel('✅ Aceitar Tradução')
                                .setStyle(ButtonStyle.Success);

                            const row = new ActionRowBuilder()
                                .addComponents(button);

                            console.log('Buscando canal de destino...');
                            try {
                                const channel = await interaction.client.channels.fetch('1021172446503637072');
                                if (!channel) {
                                    throw new Error('Canal não encontrado');
                                }

                                console.log('Enviando mensagem para o canal...');
                                const embedMessage = await channel.send({
                                    embeds: [embed],
                                    components: [row]
                                });

                                console.log('Salvando dados do pedido...');
                                userDataManager.addTranslationRequest(interaction.user.id, {
                                    gameName: gameData.name,
                                    gameEngine: gameData.engine,
                                    gameLink: gameData.link,
                                    channelId: channel.id,
                                    messageId: embedMessage.id
                                });

                                await interaction.followUp({
                                    content: '✅ Seu pedido foi enviado com sucesso!',
                                    ephemeral: true
                                });

                                // Limpar as mensagens
                                try {
                                    // Pegar as últimas mensagens do canal
                                    const messages = await interaction.channel.messages.fetch({ limit: 7 });
                                    
                                    // Filtrar apenas as mensagens do bot e do usuário relacionadas ao pedido
                                    const messagesToDelete = messages.filter(msg => 
                                        (msg.author.id === interaction.client.user.id || msg.author.id === interaction.user.id) &&
                                        msg.createdTimestamp >= interaction.createdTimestamp
                                    );

                                    // Deletar as mensagens
                                    await interaction.channel.bulkDelete(messagesToDelete);
                                } catch (error) {
                                    console.error('Erro ao limpar mensagens:', error);
                                }

                                const buttonFilter = i => i.customId === 'accept_translation';
                                const buttonCollector = embedMessage.createMessageComponentCollector({ 
                                    filter: buttonFilter, 
                                    max: 1 
                                });

                                buttonCollector.on('collect', async (i) => {
                                    try {
                                        // Atualizar o embed
                                        const updatedEmbed = EmbedBuilder.from(embed)
                                            .setColor('#00FF00') // Verde para mostrar que foi aceito
                                            .setTitle('✅ Pedido de Tradução Aceito')
                                            .addFields(
                                                { name: 'Aceito por', value: i.user.tag, inline: true },
                                                { name: 'Data de aceitação', value: new Date().toLocaleString('pt-BR'), inline: true }
                                            );

                                        // Atualizar a mensagem sem o botão
                                        await embedMessage.edit({
                                            embeds: [updatedEmbed],
                                            components: [] // Remove o botão
                                        });

                                        await i.reply(`✅ Pedido de tradução aceito por ${i.user.tag}!`);
                                        
                                        try {
                                            const user = await interaction.client.users.fetch(interaction.user.id);
                                            await user.send(`✅ Seu pedido de tradução para "${gameData.name}" foi aceito por ${i.user.tag}!`);
                                        } catch (error) {
                                            console.error('Erro ao enviar DM:', error);
                                        }
                                    } catch (error) {
                                        console.error('Erro ao processar aceitação:', error);
                                        await i.reply({
                                            content: '❌ Ocorreu um erro ao aceitar o pedido.',
                                            ephemeral: true
                                        });
                                    }
                                });
                            } catch (error) {
                                console.error('Erro ao enviar para o canal:', error);
                                await interaction.followUp({
                                    content: '❌ Erro ao enviar o pedido. Por favor, tente novamente.',
                                    ephemeral: true
                                });
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Erro durante a coleta:', error);
                    await interaction.followUp({
                        content: '❌ Ocorreu um erro ao processar sua resposta.',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.followUp({
                        content: '❌ Tempo esgotado! Por favor, tente novamente.',
                        ephemeral: true
                    }).catch(console.error);
                }
            });
        } catch (error) {
            console.error('Erro geral no comando:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.',
                    ephemeral: true
                }).catch(console.error);
            } else {
                await interaction.followUp({
                    content: '❌ Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.',
                    ephemeral: true
                }).catch(console.error);
            }
        }
    }
};