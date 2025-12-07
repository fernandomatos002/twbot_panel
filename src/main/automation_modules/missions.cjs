// src/main/automation_modules/missions.cjs (CORRIGIDO PARA BYTENODE)
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
    let coletadas = 0;

    try {
        for (const mission of missionsToCollect) {
            if (!process.connected) return;
            const questId = mission.reward_id;
            const collectUrl = `/game.php?village=${villageId}&screen=api&ajaxaction=quest_complete&quest=${questId}&skip=false`;
            const payload = { h: csrfToken };
            const bodyPayload = new URLSearchParams(payload).toString();

            // **CORREÇÃO**: Stringified function
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
                        if (!response.ok) return { error: 'Network error: ' + response.statusText };
                        return await response.json();
                    } catch (e) {
                        return { error: 'Fetch error: ' + e.message };
                    }
                }
            `, { url: collectUrl, bodyString: bodyPayload, referer: refererUrl });

            if (result.response && !result.error) {
                coletadas++;
            } else {
                if (result.error || result.response === false) {
                    sendStatus('EM_EXECUÇÃO', `Falha ao coletar missão.`);
                }
            }
            await randomWait(2500, 4500);
        }
    } catch (error) {
        console.error(`[Missions-${accountId}] Erro:`, error);
    }
}

module.exports = { execute };