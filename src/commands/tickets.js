const { SlashCommandBuilder, EmbedBuilder, ChannelType, ButtonStyle, ActionRowBuilder, ButtonBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const discordTranscripts = require('discord-html-transcripts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Configura o sistema de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Verificar permissões de gerenciamento de mensagens
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Permissão Negada')
                .setDescription('Você não tem permissão para usar este comando. Peça a um membro da staff para conceder a permissão de Gerenciar Mensagens.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Permissão necessária: Gerenciar Mensagens' });

            return interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Configuração do Sistema de Tickets')
            .setDescription('Por favor, mencione o canal onde você quer que o painel de tickets seja criado.')
            .setColor(0x00FF00);

        const message = await interaction.reply({
            embeds: [embed],
            fetchReply: true
        });

        const filter = m => m.author.id === interaction.user.id && m.mentions.channels.size > 0;
        
        try {
            const panelResponse = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 30000,
                errors: ['time']
            });

            const panelChannel = panelResponse.first().mentions.channels.first();

            // Cria o painel de tickets
            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎮 Central de Suporte 18Games')
                .setDescription('Bem-vindo à Central de Suporte do 18Games!\n\n' +
                    '**Como podemos ajudar?**\n' +
                    '> 🔧 Problemas técnicos\n' +
                    '> ❓ Dúvidas sobre o site\n' +
                    '> 💡 Sugestões\n' +
                    '> 🐛 Reportar bugs\n' +
                    '> 📝 Outros assuntos\n\n' +
                    '**Instruções:**\n' +
                    '• Clique no botão abaixo para abrir um ticket\n' +
                    '• Descreva seu problema detalhadamente\n' +
                    '• Aguarde o atendimento da nossa equipe\n\n' +
                    '**⚠️ Importante:**\n' +
                    '• Seja claro e objetivo\n' +
                    '• Forneça informações relevantes\n' +
                    '• Evite criar múltiplos tickets')
                .setColor(0x2B2D31)
                .setFooter({ text: '18Games - Sistema de Suporte' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('Abrir Ticket')
                        .setEmoji('🎫')
                        .setStyle(ButtonStyle.Primary)
                );

            await panelChannel.send({
                embeds: [ticketEmbed],
                components: [row]
            });

            // Pergunta sobre o canal de transcripts
            const transcriptEmbed = new EmbedBuilder()
                .setTitle('📝 Canal de Transcripts')
                .setDescription('Agora, mencione o canal onde você quer que os transcripts sejam salvos.')
                .setColor(0x00FF00);

            await interaction.followUp({
                embeds: [transcriptEmbed]
            });

            const transcriptResponse = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 30000,
                errors: ['time']
            });

            const transcriptChannel = transcriptResponse.first().mentions.channels.first();
            await transcriptChannel.setName('transcripts');

            // Confirmação final
            const finalEmbed = new EmbedBuilder()
                .setTitle('✅ Configuração Concluída')
                .setDescription(`Sistema de tickets configurado com sucesso!\n\nPainel: ${panelChannel}\nTranscripts: ${transcriptChannel}`)
                .setColor(0x00FF00);

            await interaction.followUp({
                embeds: [finalEmbed]
            });

        } catch (error) {
            console.error('Erro na configuração:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro na Configuração')
                .setDescription('Tempo esgotado ou ocorreu um erro. Por favor, tente novamente usando /tickets.')
                .setColor(0xFF0000);

            await interaction.followUp({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    },

    async handleTicketInteraction(interaction) {
        try {
            if (interaction.isButton()) {
                if (interaction.customId === 'create_ticket') {
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

                    const modal = new ModalBuilder()
                        .setCustomId('ticket_modal')
                        .setTitle('Criar Ticket');

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('ticket_reason')
                        .setLabel('Qual é o motivo do seu ticket?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMinLength(10)
                        .setMaxLength(1000);

                    const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(firstActionRow);

                    await interaction.showModal(modal);
                } else if (interaction.customId === 'close_ticket') {
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

                    await interaction.reply({
                        embeds: [closeEmbed],
                        components: [evaluationRow]
                    });
                }
            } else if (interaction.isModalSubmit()) {
                if (interaction.customId === 'ticket_modal') {
                    const reason = interaction.fields.getTextInputValue('ticket_reason');
                    
                    // Criar o canal do ticket
                    const ticketChannel = await this.createTicketChannel(interaction, reason);
                    
                    if (ticketChannel) {
                        await interaction.reply({
                            content: `Seu ticket foi criado em ${ticketChannel}`,
                            ephemeral: true
                        });
                    }
                }
            } else if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_evaluation') {
                try {
                    await interaction.deferUpdate();
                    const rating = interaction.values[0];
                    const channel = interaction.channel;
                    const now = new Date();

                    // Informações do ticket
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

                    const transcriptChannel = interaction.guild.channels.cache.find(
                        c => c.name === 'transcripts'
                    );

                    if (transcriptChannel) {
                        // Criar o transcript usando discord-html-transcripts
                        const transcript = await discordTranscripts.createTranscript(channel, {
                            limit: -1, // Sem limite de mensagens
                            fileName: `transcript-${channel.name}.html`,
                            saveImages: true, // Salvar imagens
                            poweredBy: false, // Remover marca d'água
                            footerText: `Ticket fechado por ${ticketInfo.closedBy} • Avaliação: ${ticketInfo.rating}`, // Texto do rodapé
                            headerText: `Transcript do Ticket: ${ticketInfo.ticketName}`, // Texto do cabeçalho
                            customHeader: `
                                <div class="info-header">
                                    <div class="info-item">
                                        <strong>Usuário:</strong> ${ticketInfo.user}
                                    </div>
                                    <div class="info-item">
                                        <strong>ID do Usuário:</strong> ${ticketInfo.userId}
                                    </div>
                                    <div class="info-item">
                                        <strong>Avaliação:</strong> ${ticketInfo.rating}
                                    </div>
                                    <div class="info-item">
                                        <strong>Fechado por:</strong> ${ticketInfo.closedBy}
                                    </div>
                                    <div class="info-item">
                                        <strong>Data de Fechamento:</strong> ${ticketInfo.closedAt}
                                    </div>
                                </div>
                            `,
                            customCSS: `
                                .info-header {
                                    background-color: #2B2D31;
                                    color: white;
                                    padding: 20px;
                                    border-radius: 10px;
                                    margin-bottom: 20px;
                                }
                                .info-item {
                                    margin: 10px 0;
                                }
                            `
                        });

                        // Criar embed com informações do ticket
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

                        // Enviar transcript
                        await transcriptChannel.send({
                            embeds: [closeEmbed],
                            files: [transcript]
                        });

                        // Mensagem final e fechar canal
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
                    await interaction.editReply({
                        content: 'Houve um erro ao processar sua avaliação.',
                        components: []
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao lidar com interação de ticket:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Houve um erro ao processar sua solicitação.',
                    ephemeral: true
                });
            }
        }
    },

    async createTicketChannel(interaction, reason) {
        try {
            // Pegar o ID do bot
            const botId = interaction.client.user.id;

            // Procurar ou criar categoria de tickets
            let ticketCategory = interaction.guild.channels.cache.find(
                c => c.name.toLowerCase() === 'tickets' && c.type === ChannelType.GuildCategory
            );

            // Se não existir, criar a categoria
            if (!ticketCategory) {
                ticketCategory = await interaction.guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: botId,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ManageMessages,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        }
                    ]
                });
            }

            // Criar canal do ticket
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: ticketCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: botId, // Bot
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: interaction.user.id, // Usuário que criou o ticket
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Criado')
                .setDescription(`Olá ${interaction.user}, bem-vindo ao seu ticket!\n\n` +
                    '**Motivo do Ticket:**\n' +
                    `${reason}\n\n` +
                    '**Como podemos ajudar?**\n' +
                    'Nossa equipe irá analisar seu ticket em breve.')
                .setColor(0x2B2D31)
                .setTimestamp();

            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Fechar Ticket')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({
                content: `${interaction.user}`,
                embeds: [welcomeEmbed],
                components: [closeButton]
            });

            return ticketChannel;
        } catch (error) {
            console.error('Erro ao criar canal de ticket:', error);
            throw error;
        }
    }
};
