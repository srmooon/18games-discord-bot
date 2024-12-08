const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

        // Botão de criar ticket
        if (interaction.isButton() && interaction.customId === 'create_ticket') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_modal')
                    .setTitle('Criar Ticket');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('ticket_reason')
                    .setLabel('Qual é a razão do seu ticket?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explique o motivo do seu ticket...')
                    .setRequired(true)
                    .setMinLength(10)
                    .setMaxLength(1000);

                const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            } catch (error) {
                console.error('Erro ao mostrar modal de ticket:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Houve um erro ao abrir o ticket. Tente novamente.',
                        ephemeral: true
                    });
                }
            }
        }

        // Modal submit de criar ticket
        if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
            try {
                const reason = interaction.fields.getTextInputValue('ticket_reason');

                // Verificar se o usuário já tem um ticket aberto
                const existingTicket = interaction.guild.channels.cache.find(
                    channel => channel.name === `ticket-${interaction.user.username.toLowerCase()}`
                );

                if (existingTicket) {
                    return await interaction.reply({
                        content: `Você já tem um ticket aberto em ${existingTicket}. Por favor, utilize o ticket existente.`,
                        ephemeral: true
                    });
                }

                // Criar canal do ticket
                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: interaction.guild.channels.cache.find(
                        c => c.name.toLowerCase() === 'tickets' && c.type === ChannelType.GuildCategory
                    ),
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Criado')
                    .setDescription(`Olá ${interaction.user}, bem-vindo ao seu ticket de suporte!\n\n` +
                        '**Motivo do Ticket:**\n' +
                        `${reason}\n\n` +
                        '**Como podemos ajudar?**\n' +
                        'Nossa equipe irá analisar seu ticket em breve.')
                    .setColor(0x3498db)
                    .setTimestamp();

                const closeButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Fechar Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                await ticketChannel.send({
                    content: `${interaction.user}`,
                    embeds: [welcomeEmbed],
                    components: [closeButton]
                });

                await interaction.reply({
                    content: `✅ Seu ticket foi criado em ${ticketChannel}`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Erro ao criar ticket:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Houve um erro ao criar o ticket. Tente novamente.',
                        ephemeral: true
                    });
                }
            }
        }

        // Botão de fechar ticket
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            try {
                await interaction.deferReply();

                const channel = interaction.channel;
                
                // Criar menu de avaliação
                const evaluationRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('ticket_evaluation')
                            .setPlaceholder('Como você avalia o atendimento?')
                            .addOptions([
                                {
                                    label: 'Excelente',
                                    value: '5',
                                    emoji: '⭐',
                                    description: 'Atendimento excepcional'
                                },
                                {
                                    label: 'Muito Bom',
                                    value: '4',
                                    emoji: '⭐',
                                    description: 'Atendimento muito bom'
                                },
                                {
                                    label: 'Bom',
                                    value: '3',
                                    emoji: '⭐',
                                    description: 'Atendimento satisfatório'
                                },
                                {
                                    label: 'Regular',
                                    value: '2',
                                    emoji: '⭐',
                                    description: 'Atendimento regular'
                                },
                                {
                                    label: 'Ruim',
                                    value: '1',
                                    emoji: '⭐',
                                    description: 'Atendimento insatisfatório'
                                }
                            ])
                    );

                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Fechar Ticket')
                    .setDescription('Por favor, avalie o atendimento antes de fechar o ticket.')
                    .setColor(0xFF0000);

                await interaction.editReply({
                    embeds: [closeEmbed],
                    components: [evaluationRow]
                });
            } catch (error) {
                console.error('Erro ao fechar ticket:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Houve um erro ao fechar o ticket. Tente novamente.',
                        ephemeral: true
                    });
                }
            }
        }

        // Menu de avaliação
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_evaluation') {
            try {
                await interaction.deferUpdate();
                const rating = interaction.values[0];
                const channel = interaction.channel;
                const now = new Date();

                // Informações do ticket para o transcript
                const ticketInfo = {
                    ticketName: channel.name,
                    user: interaction.user.tag,
                    userId: interaction.user.id,
                    rating: `${rating}⭐`,
                    closedBy: interaction.user.tag,
                    closedAt: now.toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    })
                };

                // Criar HTML personalizado
                const customHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Transcript do Ticket ${ticketInfo.ticketName}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 800px;
                            margin: 20px auto;
                            padding: 20px;
                            background-color: #f5f5f5;
                        }
                        .header {
                            background-color: #2B2D31;
                            color: white;
                            padding: 20px;
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        .info {
                            background-color: white;
                            padding: 20px;
                            border-radius: 10px;
                            margin-bottom: 20px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        }
                        .messages {
                            background-color: white;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        }
                        .message {
                            margin-bottom: 10px;
                            padding: 10px;
                            border-bottom: 1px solid #eee;
                        }
                        .timestamp {
                            color: #666;
                            font-size: 0.8em;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🎫 Transcript do Ticket</h1>
                    </div>
                    <div class="info">
                        <h2>Informações do Ticket</h2>
                        <p><strong>Ticket:</strong> ${ticketInfo.ticketName}</p>
                        <p><strong>Usuário:</strong> ${ticketInfo.user}</p>
                        <p><strong>ID do Usuário:</strong> ${ticketInfo.userId}</p>
                        <p><strong>Avaliação:</strong> ${ticketInfo.rating}</p>
                        <p><strong>Fechado por:</strong> ${ticketInfo.closedBy}</p>
                        <p><strong>Data de Fechamento:</strong> ${ticketInfo.closedAt}</p>
                    </div>
                    <div class="messages">
                        <h2>Mensagens</h2>
                        {{MESSAGES}}
                    </div>
                </body>
                </html>`;

                // Coletar mensagens
                const messages = await channel.messages.fetch({ limit: 100 });
                const messageHtml = messages.reverse().map(msg => `
                    <div class="message">
                        <strong>${msg.author.tag}</strong>
                        <span class="timestamp">${msg.createdAt.toLocaleString()}</span>
                        <p>${msg.content}</p>
                    </div>
                `).join('');

                const finalHtml = customHtml.replace('{{MESSAGES}}', messageHtml);

                const transcriptChannel = interaction.guild.channels.cache.find(
                    c => c.name === 'transcripts'
                );

                if (transcriptChannel) {
                    const closeEmbed = new EmbedBuilder()
                        .setTitle('📋 Ticket Fechado')
                        .setDescription(
                            `**Ticket:** ${ticketInfo.ticketName}\n` +
                            `**Usuário:** ${ticketInfo.user}\n` +
                            `**ID do Usuário:** ${ticketInfo.userId}\n` +
                            `**Avaliação:** ${ticketInfo.rating}\n` +
                            `**Fechado por:** ${ticketInfo.closedBy}\n` +
                            `**Data de Fechamento:** ${ticketInfo.closedAt}`
                        )
                        .setColor(0xFF0000)
                        .setTimestamp();

                    await transcriptChannel.send({ 
                        embeds: [closeEmbed],
                        files: [{
                            attachment: Buffer.from(finalHtml),
                            name: `transcript-${channel.name}.html`
                        }]
                    });

                    const finalMessage = new EmbedBuilder()
                        .setTitle('✅ Ticket Fechado')
                        .setDescription(`Obrigado pela sua avaliação de ${rating}⭐!\nO ticket será fechado em 5 segundos.`)
                        .setColor(0x00FF00);

                    await interaction.editReply({
                        embeds: [finalMessage],
                        components: []
                    });

                    // Aguardar 5 segundos antes de deletar o canal
                    setTimeout(() => {
                        channel.delete().catch(console.error);
                    }, 5000);
                }
            } catch (error) {
                console.error('Erro ao processar avaliação:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Houve um erro ao processar sua avaliação.',
                        ephemeral: true
                    });
                }
            }
        }
    }
};
