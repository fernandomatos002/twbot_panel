// src/main/automation_modules/rewards.cjs (CORRIGIDO PARA BYTENODE)
const { randomWait } = require('../utils/helpers.cjs');

async function execute(page, sendStatus, config, gameState) {
    const accountId = config.accountId;
    const villageId = config.villageId;
    const csrfToken = gameState.csrfToken;

    if (!csrfToken) return;

    const rewardsToCollect = gameState.collectableRewards || [];
    if (rewardsToCollect.length === 0) return;

    sendStatus('EM_EXECUÇÃO', `Coletando recompensas...`);
    const collectUrl = `/game.php?village=${villageId}&screen=new_quests&ajax=claim_reward`;
    const refererUrl = page.url();
    let coletadas = 0;

    try {
        for (const reward of rewardsToCollect) {
            if (!process.connected) return;
            const payload = { reward_id: reward.reward_id, h: csrfToken };
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

            if (result?.response?.claimed?.id) {
                coletadas++;
            } else {
                if (result.error || result.response === false) {
                    sendStatus('EM_EXECUÇÃO', `Falha ao coletar recompensa.`);
                }
            }
            await randomWait(2500, 4500);
        }
    } catch (error) {
        console.error(`[Rewards-${accountId}] Erro:`, error);
    }
}

module.exports = { execute };