const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jogodavelha')
    .setDescription('「Diversão」Inicia uma partida de Jogo da Velha!')
    .addUserOption((option) =>
      option
        .setName('oponente')
        .setDescription(
          'Escolha um jogador para jogar contra você. Se não escolher, jogará contra o Bot.',
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('dificuldade')
        .setDescription(
          'Escolha o nível de dificuldade: Fácil, Médio ou Difícil (apenas válido contra o Bot)',
        )
        .setRequired(false)
        .addChoices(
          { name: 'Fácil', value: 'facil' },
          { name: 'Médio', value: 'medio' },
          { name: 'Difícil', value: 'dificil' },
        ),
    ),
  async execute(interaction) {
    const { query } = require('../../../../../infrastructure/database/legacy.js');
    const player1 = interaction.user;
    let player2 = interaction.options.getUser('oponente');
    if (!player2 || player2.id === interaction.client.user.id) {
      player2 = { id: 'bot', username: 'Bot' };
    }
    if (player1.id === player2.id && player2.id !== 'bot') {
      return interaction.reply({
        content:
          'Você não pode jogar sozinho! Escolha outro jogador ou deixe em branco para jogar contra o Bot.',
        flags: 64,
      });
    }
    const dificuldade = interaction.options.getString('dificuldade') || 'dificil';

    // Variáveis globais do jogo
    let board,
      currentPlayer,
      lastGameResult = '',
      lastMove = null,
      moveHistory = [],
      message = null;
    const symbols = { [player1.id]: '❌', [player2.id]: '⭕' };

    board = [
      ['⬜', '⬜', '⬜'],
      ['⬜', '⬜', '⬜'],
      ['⬜', '⬜', '⬜'],
    ];
    currentPlayer = player1;

    // =============================================
    // FUNÇÕES DE BANCO DE DADOS (Pool centralizado)
    // =============================================

    async function ensureStats(userId, isBot = false) {
      const table = isBot ? 'bot_stats' : 'uvs_stats';
      try {
        await query(`INSERT IGNORE INTO ${table} (user_id) VALUES (?)`, [userId]);
      } catch (error) {
        interaction.client.services.logger.error(
          `❌ Erro ao garantir stats para ${userId}:`,
          error.message,
        );
      }
    }

    async function updateBotStats(userId, result, difficulty) {
      await ensureStats(userId, true);
      try {
        const [wins, draws, losses] =
          result === 'win' ? [1, 0, 0] : result === 'draw' ? [0, 1, 0] : [0, 0, 1];

        await query(
          `UPDATE bot_stats SET total = total + 1, wins = wins + ?, draws = draws + ?, losses = losses + ? WHERE user_id = ?`,
          [wins, draws, losses, userId],
        );

        await query(
          `UPDATE bot_stats SET ${difficulty}_wins = ${difficulty}_wins + ?, ${difficulty}_draws = ${difficulty}_draws + ?, ${difficulty}_losses = ${difficulty}_losses + ? WHERE user_id = ?`,
          [wins, draws, losses, userId],
        );
      } catch (error) {
        interaction.client.services.logger.error('❌ Erro ao atualizar bot_stats:', error);
      }
    }

    async function updateUvsStats(winnerId, loserId) {
      await ensureStats(winnerId);
      await ensureStats(loserId);
      try {
        await query(`UPDATE uvs_stats SET wins = wins + 1, total = total + 1 WHERE user_id = ?`, [
          winnerId,
        ]);
        await query(
          `UPDATE uvs_stats SET losses = losses + 1, total = total + 1 WHERE user_id = ?`,
          [loserId],
        );
      } catch (error) {
        interaction.client.services.logger.error('❌ Erro ao atualizar uvs_stats:', error);
      }
    }

    async function updateUvsStatsDraw(playerA, playerB) {
      await ensureStats(playerA);
      await ensureStats(playerB);
      try {
        await query(`UPDATE uvs_stats SET draws = draws + 1, total = total + 1 WHERE user_id = ?`, [
          playerA,
        ]);
        await query(`UPDATE uvs_stats SET draws = draws + 1, total = total + 1 WHERE user_id = ?`, [
          playerB,
        ]);
      } catch (error) {
        interaction.client.services.logger.error('❌ Erro ao atualizar draws:', error);
      }
    }

    // =============================================
    // FUNÇÕES DO JOGO
    // =============================================

    function formatLastMove() {
      if (!lastMove) return '';
      return `Última jogada: **${lastMove.player}** colocou **${lastMove.symbol}** em (Linha ${lastMove.row + 1}, Coluna ${lastMove.col + 1}).`;
    }

    function formatBoard() {
      return board
        .map((row) =>
          row
            .map((cell) => {
              if (cell === symbols[player1.id]) return 'X';
              if (cell === symbols[player2.id]) return 'O';
              return ' ';
            })
            .join(' | '),
        )
        .join('\n');
    }

    function updateEmbed() {
      const opponentName = player2.id === 'bot' ? 'Bot' : player2.username;
      let description = `🔹 **${player1.username}** (X) vs **${opponentName}** (O)\n🎲 Turno de: ${currentPlayer.id === 'bot' ? 'Bot' : currentPlayer.username}`;
      if (lastGameResult) {
        description += `\n\nResultado da partida anterior: **${lastGameResult}**\n${formatLastMove()}`;
      }
      const embed = new EmbedBuilder()
        .setTitle('🎮 Jogo da Velha')
        .setDescription(description)
        .setColor(0x5865f2);
      if (lastGameResult) {
        embed.addFields({ name: 'Tabuleiro Final', value: formatBoard() });
      }
      return embed;
    }

    function createBoard() {
      const rows = [];
      for (let i = 0; i < board.length; i++) {
        const actionRow = new ActionRowBuilder();
        for (let j = 0; j < board[i].length; j++) {
          actionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`move_${i}_${j}`)
              .setLabel(board[i][j])
              .setStyle(board[i][j] === '⬜' ? ButtonStyle.Secondary : ButtonStyle.Primary)
              .setDisabled(board[i][j] !== '⬜'),
          );
        }
        rows.push(actionRow);
      }
      return rows;
    }

    function checkWinner() {
      for (let i = 0; i < 3; i++) {
        if (board[i][0] !== '⬜' && board[i][0] === board[i][1] && board[i][1] === board[i][2])
          return board[i][0];
        if (board[0][i] !== '⬜' && board[0][i] === board[1][i] && board[1][i] === board[2][i])
          return board[0][i];
      }
      if (board[0][0] !== '⬜' && board[0][0] === board[1][1] && board[1][1] === board[2][2])
        return board[0][0];
      if (board[0][2] !== '⬜' && board[0][2] === board[1][1] && board[1][1] === board[2][0])
        return board[0][2];
      return null;
    }

    function isBoardFull() {
      return board.every((row) => row.every((cell) => cell !== '⬜'));
    }

    // ===============================
    // Algoritmo minimax (IA)
    // ===============================
    function isMovesLeft(board) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (board[i][j] === '⬜') return true;
        }
      }
      return false;
    }

    function evaluateBoard(board) {
      const botSym = symbols['bot'];
      for (let i = 0; i < 3; i++) {
        if (board[i][0] !== '⬜' && board[i][0] === board[i][1] && board[i][1] === board[i][2])
          return board[i][0] === botSym ? 10 : -10;
      }
      for (let j = 0; j < 3; j++) {
        if (board[0][j] !== '⬜' && board[0][j] === board[1][j] && board[1][j] === board[2][j])
          return board[0][j] === botSym ? 10 : -10;
      }
      if (board[0][0] !== '⬜' && board[0][0] === board[1][1] && board[1][1] === board[2][2])
        return board[0][0] === botSym ? 10 : -10;
      if (board[0][2] !== '⬜' && board[0][2] === board[1][1] && board[1][1] === board[2][0])
        return board[0][2] === botSym ? 10 : -10;
      return 0;
    }

    function minimax(board, depth, isMaximizing) {
      const score = evaluateBoard(board);
      if (score === 10 || score === -10) return score;
      if (!isMovesLeft(board)) return 0;
      if (isMaximizing) {
        let best = -Infinity;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (board[i][j] === '⬜') {
              board[i][j] = symbols['bot'];
              best = Math.max(best, minimax(board, depth + 1, false));
              board[i][j] = '⬜';
            }
          }
        }
        return best;
      } else {
        let best = Infinity;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (board[i][j] === '⬜') {
              board[i][j] = symbols[player1.id];
              best = Math.min(best, minimax(board, depth + 1, true));
              board[i][j] = '⬜';
            }
          }
        }
        return best;
      }
    }

    function findBestMove() {
      let bestVal = -Infinity;
      let bestMove = null;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (board[i][j] === '⬜') {
            board[i][j] = symbols['bot'];
            let moveVal = minimax(board, 0, false);
            board[i][j] = '⬜';
            if (moveVal > bestVal) {
              bestVal = moveVal;
              bestMove = [i, j];
            }
          }
        }
      }
      return bestMove;
    }

    function randomMove() {
      let emptyCells = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (board[i][j] === '⬜') emptyCells.push([i, j]);
        }
      }
      if (emptyCells.length > 0) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
      }
      return null;
    }

    // ===============================
    // Início e reinício do jogo
    // ===============================
    async function startGame() {
      board = [
        ['⬜', '⬜', '⬜'],
        ['⬜', '⬜', '⬜'],
        ['⬜', '⬜', '⬜'],
      ];
      currentPlayer = player1;
      lastMove = null;
      moveHistory = [];
      await interaction.editReply({ embeds: [updateEmbed()], components: createBoard() });
      createMoveCollector();
    }

    function createMoveCollector() {
      const moveCollector = message.createMessageComponentCollector({ time: 300000 });
      moveCollector.on('collect', async (buttonInteraction) => {
        if (currentPlayer.id === 'bot') {
          return buttonInteraction.reply({
            content: 'Aguarde, é a vez do Bot jogar...',
            flags: 64,
          });
        }
        if (buttonInteraction.user.id !== currentPlayer.id) {
          return buttonInteraction.reply({ content: 'Não é sua vez de jogar!', flags: 64 });
        }
        const [, row, col] = buttonInteraction.customId.split('_').map(Number);
        if (board[row][col] !== '⬜') return;
        board[row][col] = symbols[currentPlayer.id];
        lastMove = {
          player: buttonInteraction.user.username,
          row,
          col,
          symbol: symbols[currentPlayer.id],
        };
        moveHistory.push({ move: moveHistory.length + 1, ...lastMove });
        const winnerSymbol = checkWinner();
        if (winnerSymbol) {
          lastGameResult = winnerSymbol === symbols[player1.id] ? 'Vitória' : 'Derrota';
          const embed = updateEmbed();
          embed.setDescription(
            `🏆 **${currentPlayer.username} venceu!**\n\n🔹 **${player1.username}** (X) vs **${player2.id === 'bot' ? 'Bot' : player2.username}** (O)`,
          );
          embed.setColor(0xffd700);
          await buttonInteraction.update({ embeds: [embed], components: [] });
          moveCollector.stop();
          if (player2.id === 'bot') {
            await updateBotStats(
              player1.id,
              winnerSymbol === symbols[player1.id] ? 'win' : 'loss',
              dificuldade,
            );
          } else {
            const loser = currentPlayer.id === player1.id ? player2 : player1;
            await updateUvsStats(currentPlayer.id, loser.id);
          }
          showPlayAgainButton();
          return;
        }
        if (isBoardFull()) {
          lastGameResult = 'Empate';
          const embed = updateEmbed();
          embed.setDescription('🤝 O jogo terminou em empate!');
          embed.setColor(0x808080);
          await buttonInteraction.update({ embeds: [embed], components: [] });
          moveCollector.stop();
          if (player2.id === 'bot') {
            await updateBotStats(player1.id, 'draw', dificuldade);
          } else {
            await updateUvsStatsDraw(player1.id, player2.id);
          }
          showPlayAgainButton();
          return;
        }
        currentPlayer = currentPlayer.id === player1.id ? player2 : player1;
        await buttonInteraction.update({ embeds: [updateEmbed()], components: createBoard() });
        if (currentPlayer.id === 'bot') {
          botPlay(moveCollector);
        }
      });
      moveCollector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
    }

    async function botPlay(moveCollector) {
      await new Promise((r) => setTimeout(r, 1000));
      let botMove = null;
      if (dificuldade === 'facil') {
        botMove = randomMove();
      } else if (dificuldade === 'medio') {
        botMove = Math.random() < 0.5 ? randomMove() : findBestMove();
      } else {
        botMove = findBestMove();
      }
      if (botMove) {
        const [row, col] = botMove;
        board[row][col] = symbols['bot'];
        lastMove = { player: 'Bot', row, col, symbol: symbols['bot'] };
        moveHistory.push({ move: moveHistory.length + 1, ...lastMove });
      }
      const winnerSymbol = checkWinner();
      if (winnerSymbol) {
        lastGameResult = winnerSymbol === symbols[player1.id] ? 'Vitória' : 'Derrota';
        const embed = updateEmbed();
        embed.setDescription(`🏆 **Bot venceu!**\n\n🔹 **${player1.username}** (X) vs **Bot** (O)`);
        embed.setColor(0xffd700);
        await interaction.editReply({ embeds: [embed], components: [] });
        moveCollector.stop();
        await updateBotStats(
          player1.id,
          winnerSymbol === symbols[player1.id] ? 'win' : 'loss',
          dificuldade,
        );
        showPlayAgainButton();
        return;
      }
      if (isBoardFull()) {
        lastGameResult = 'Empate';
        const embed = updateEmbed();
        embed.setDescription('🤝 O jogo terminou em empate!');
        embed.setColor(0x808080);
        await interaction.editReply({ embeds: [embed], components: [] });
        moveCollector.stop();
        await updateBotStats(player1.id, 'draw', dificuldade);
        showPlayAgainButton();
        return;
      }
      currentPlayer = player1;
      await interaction.editReply({ embeds: [updateEmbed()], components: createBoard() });
    }

    async function showPlayAgainButton() {
      const playAgainRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('play_again')
          .setLabel('Jogar Novamente')
          .setStyle(ButtonStyle.Success),
      );
      const newMessage = await interaction.editReply({ components: [playAgainRow] });
      const playAgainCollector = newMessage.createMessageComponentCollector({
        filter: (i) => i.customId === 'play_again',
        time: 300000,
        max: 1,
      });
      playAgainCollector.on('collect', async (buttonInteraction) => {
        await buttonInteraction.update({ content: 'Iniciando nova partida...', components: [] });
        startGame();
      });
    }

    await interaction.reply({ embeds: [updateEmbed()], components: createBoard() });
    message = await interaction.fetchReply();
    startGame();
  },
};
