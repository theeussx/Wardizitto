# 🚀 Sistema Híbrido de Comandos - Wardizitto

O Wardizitto agora suporta um sistema híbrido de comandos, permitindo o uso de **Slash Commands** (comandos de barra) e **Prefix Commands** (comandos de prefixo), organizados de forma eficiente.

## 📂 Estrutura de Pastas

Os comandos estão divididos em duas categorias principais dentro da pasta `commands/`:

-   **`commands/Slash/`**: Contém comandos que utilizam a API de Slash Commands do Discord.
    -   Organizados por subpastas (ex: `admin/`, `economia/`, `util/`).
    -   Devem exportar um objeto com `data` (SlashCommandBuilder) e `execute`.
-   **`commands/Prefix/`**: Contém comandos que são acionados via prefixo (ex: `!ping`).
    -   Organizados por subpastas (ex: `admin/`, `economia/`, `util/`).
    -   Devem exportar um objeto com `name`, `description` e `run`.

## ⚙️ Configuração no `.env`

Novas variáveis foram adicionadas ao arquivo `.env` para controlar o comportamento dos comandos:

```ini
# Prefixo para comandos clássicos
PREFIX=!

# Registro de Slash Commands
# Se true, registra para todos os servidores (pode levar até 1h para atualizar)
# Se false, registra apenas no servidor especificado em GUILD_ID (instantâneo)
GLOBAL_SLASH=false

# ID do servidor para registro local (usado quando GLOBAL_SLASH=false)
GUILD_ID=SEU_ID_DO_SERVIDOR_AQUI
```

## 🛠️ Como Criar Novos Comandos

### Comando Slash (Exemplo)
Crie em `commands/Slash/categoria/nome.js`:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde com Pong!'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    }
};
```

### Comando de Prefixo (Exemplo)
Crie em `commands/Prefix/categoria/nome.js`:
```javascript
module.exports = {
    name: 'ping',
    description: 'Responde com Pong!',
    run: async (client, message, args) => {
        message.reply('Pong!');
    }
};
```

## 🔄 Registro de Comandos
O bot agora gerencia o registro de Slash Commands automaticamente ao iniciar, respeitando as configurações de `GLOBAL_SLASH` e `GUILD_ID`. Comandos de prefixo são carregados instantaneamente na memória.

---
*Documentação gerada por Manus AI para o projeto Wardizitto.*
