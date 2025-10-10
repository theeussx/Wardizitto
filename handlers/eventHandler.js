const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');

    // Função para ler arquivos de eventos recursivamente
    const readEvents = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(dir, file.name);

            if (file.isDirectory()) {
                // Se for uma pasta, chama a função recursivamente
                readEvents(filePath);
            } else if (file.name.endsWith('.js')) {
                // Se for um arquivo .js, carrega o evento
                const event = require(filePath);

                if (typeof event === 'function') {
                    // Se for um módulo de inicialização, executa passando o client
                    event(client);
                } else if (event.name) {
                    // Se for um evento do Discord, registra corretamente
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                }
            }
        }
    };

    // Inicia a leitura recursiva a partir da pasta events
    readEvents(eventsPath);
};