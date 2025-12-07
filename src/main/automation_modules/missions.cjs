// src/main/automation_modules/missions.cjs
const { randomWait } = require('../utils/helpers.cjs');

async function execute(page, sendStatus, config, gameState) {
    const accountId = config.accountId;
    const villageId = config.villageId;
    const csrfToken = gameState.csrfToken;

    if (!csrfToken) return;

    const missionsToCollect = gameState.completedMissions || [];
    if (missionsToCollect.length === 0) return;
    
    sendStatus('EM_EXECUÇÃO', `Coletando missões...`);
    const refererUrl = page.url();
    
    try {
        for (const mission of missionsToCollect) {
            if (!process.connected) return;
            const questId = mission.reward_id;
            const collectUrl = `/game.php?village=${villageId}&screen=api&ajaxaction=quest_complete&quest=${questId}&skip=false`;
            const payload = { h: csrfToken };
            const bodyPayload = new URLSearchParams(payload).toString();

            const result = await page.evaluate(`
                async ({ url, bodyString, referer }) => {
                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'Accept': 'application/json, text/javascript, */*',
                                'TribalWars-Ajax': '1',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Referer': referer
                            },
                            body: bodyString
                        });
                        
                        const text = await response.text();
                        try {
                            return JSON.parse(text);
                        } catch (e) {
                            return { error: 'Invalid JSON', raw: text.substring(0, 50) };
                        }
                    } catch (e) {
                        return { error: 'Fetch error: ' + e.message };
                    }
                }
            `, { url: collectUrl, bodyString: bodyPayload, referer: refererUrl });

            // A resposta de sucesso pode variar, geralmente checamos se não há erro
            if (result && !result.error && result.response !== false) {
                // Sucesso
            } else {
                console.warn(`[Missions-${accountId}] Falha ao coletar:`, JSON.stringify(result));
            }
            await randomWait(1500, 3000);
        }
    } catch (error) {
        console.error(`[Missions-${accountId}] Erro:`, error.message);
    }
}

module.exports = { execute };