const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra o status do site 18Games'),
    
    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('📊 Status do 18Games')
                .setColor(0x2B2D31)
                .setDescription('Bem-vindo ao 18Games, sua fonte de jogos adultos traduzidos!')
                .addFields(
                    { 
                        name: '🌐 Site Oficial', 
                        value: '[18Games.xyz](https://18games.xyz)\nSeu portal para jogos adultos traduzidos', 
                        inline: false 
                    },
                    { 
                        name: '🟢 Status do Site', 
                        value: 'Online e funcionando normalmente', 
                        inline: true 
                    },
                    { 
                        name: '🎮 Jogos Disponíveis', 
                        value: 'Acesse o site para ver nossa coleção', 
                        inline: true 
                    },
                    { 
                        name: '🔄 Última Atualização', 
                        value: new Date().toLocaleString('pt-BR'), 
                        inline: true 
                    },
                    { 
                        name: '💬 Discord Oficial', 
                        value: '[Clique aqui para entrar](https://discord.gg/Ns2UU7fgrU)', 
                        inline: false 
                    },
                    { 
                        name: '💡 Recursos', 
                        value: '• Traduções de Qualidade\n• Suporte Ativo\n• Comunidade Engajada\n• Atualizações Frequentes', 
                        inline: false 
                    }
                )
                .setTimestamp()
                .setFooter({ 
                    text: '18Games - Sua fonte de jogos adultos traduzidos', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erro ao executar comando status:', error);
            await interaction.reply({ 
                content: '❌ Ocorreu um erro ao verificar o status. Você pode acessar o site em: https://18games.xyz', 
                ephemeral: true 
            });
        }
    },
};
