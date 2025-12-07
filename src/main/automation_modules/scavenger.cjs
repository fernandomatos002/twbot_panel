// src/main/automation_modules/scavenger.cjs
const { randomWait } = require('../utils/helpers.cjs');
const WEIGHTS = { "1": 15, "2": 6, "3": 3, "4": 2 };
const MIN_INFANTRY_TO_SCAVENGE = 10;
const CARRY_CAPACITY = { spear: 25, sword: 15 };
const UNLOCK_COSTS = {
    "1": { wood: 25, stone: 30, iron: 25 },
    "2": { wood: 250, stone: 300, iron: 250 },
    "3": { wood: 1000, stone: 1200, iron: 1000 },
    "4": { wood: 10000, stone: 12000, iron: 10000 }
};

async function execute(page, sendStatus, config, gameState) {
    const accountId = config.accountId;
    const csrfToken = gameState.csrfToken;
    let newScavengeState = null;

    if (!csrfToken || !gameState.scavengeInfo?.options) return newScavengeState;
    
    const options = gameState.scavengeInfo.options;
    const troopsAvailable = gameState.scavengeInfo.unit_counts_home || {};
    const totalSpears = troopsAvailable.spear || 0;
    const totalSwords = troopsAvailable.sword || 0;
    const totalInfantryPool = totalSpears + totalSwords;
    const currentRes = gameState.resources;

    try {
        // --- Desbloqueio ---
        let unlockedSomething = false;
        for (const optionId in options) {
            const option = options[optionId];
            if (option.is_locked === true && option.unlock_time === null) {
                if (unlockedSomething) continue;
                if (!checkResourcesForUnlock(accountId, currentRes, UNLOCK_COSTS[optionId], optionId)) continue;

                sendStatus('EM_EXECUÇÃO', `Desbloqueando opção ${optionId}...`);
                const unlockResult = await unlockScavengeOption(page, config, csrfToken, optionId);
                if (unlockResult) {
                    unlockedSomething = true;
                    newScavengeState = unlockResult;
                }
            }
        }
        
        // --- Envio de Tropas ---
        const freeSlots = [];
        const currentOptionsState = newScavengeState ? (newScavengeState.options || options) : options;
        for (const optionId in currentOptionsState) {
            const opt = currentOptionsState[optionId];
            if (opt.scavenging_squad === null && opt.is_locked === false) {
                freeSlots.push(optionId);
            }
        }

        if (freeSlots.length === 0 || totalInfantryPool < MIN_INFANTRY_TO_SCAVENGE) return newScavengeState;
        
        let totalWeight = 0;
        for (const id of freeSlots) totalWeight += WEIGHTS[id] || 0;
        if (totalWeight === 0) return newScavengeState;

        const spearProportion = totalSpears / totalInfantryPool;
        let spearsAllocated = 0;
        let swordsAllocated = 0;
        const troopsToAllocate = {};

        for (let i = 0; i < freeSlots.length - 1; i++) {
            const optionId = freeSlots[i];
            const totalTroopsForSlot = Math.floor(totalInfantryPool * (WEIGHTS[optionId] / totalWeight));
            const spearsForSlot = Math.floor(totalTroopsForSlot * spearProportion);
            const swordsForSlot = totalTroopsForSlot - spearsForSlot;
            troopsToAllocate[optionId] = { spear: spearsForSlot, sword: swordsForSlot };
            spearsAllocated += spearsForSlot;
            swordsAllocated += swordsForSlot;
        }
        
        const lastSlotId = freeSlots[freeSlots.length - 1];
        troopsToAllocate[lastSlotId] = {
            spear: totalSpears - spearsAllocated,
            sword: totalSwords - swordsAllocated
        };

        for (const optionId in troopsToAllocate) {
            const troops = troopsToAllocate[optionId];
            const carryCapacity = (troops.spear * CARRY_CAPACITY.spear) + (troops.sword * CARRY_CAPACITY.sword);
            if (troops.spear > 0 || troops.sword > 0) {
                const sendResult = await sendScavengeSquad(page, config, csrfToken, optionId, troops, carryCapacity);
                if (sendResult) newScavengeState = sendResult;
                await randomWait(500, 1500);
            }
        }
        
        return newScavengeState;
    } catch (error) {
        console.error(`[Scavenger-${accountId}] Erro:`, error);
        return newScavengeState;
    }
}

function checkResourcesForUnlock(accountId, currentRes, costs, optionId) {
    if (!costs) return true;
    return !(currentRes.wood < costs.wood || currentRes.clay < costs.stone || currentRes.iron < costs.iron);
}

// --- Funções Auxiliares Blindadas ---

async function unlockScavengeOption(page, config, csrfToken, optionId) {
    const url = `/game.php?village=${config.villageId}&screen=scavenge_api&ajaxaction=start_unlock`;
    const payload = { village_id: config.villageId, option_id: optionId, h: csrfToken };
    const bodyPayload = new URLSearchParams(payload).toString();
    const refererUrl = page.url();

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
                try { return JSON.parse(text); } catch(e) { return { error: 'JSON Error', raw: text }; }
            } catch (e) {
                return { error: 'Fetch error: ' + e.message };
            }
        }
    `, { url, bodyString: bodyPayload, referer: refererUrl });

    if (result && result.response && result.response.village) {
        return result.response.village; 
    }
    return null;
}

async function sendScavengeSquad(page, config, csrfToken, optionId, troops, carryCapacity) {
    const url = `/game.php?village=${config.villageId}&screen=scavenge_api&ajaxaction=send_squads`;
    const payload = {
        'squad_requests[0][village_id]': config.villageId,
        'squad_requests[0][option_id]': optionId,
        'squad_requests[0][use_premium]': 'false',
        'squad_requests[0][candidate_squad][unit_counts][spear]': troops.spear || 0,
        'squad_requests[0][candidate_squad][unit_counts][sword]': troops.sword || 0,
        'squad_requests[0][candidate_squad][unit_counts][axe]': 0,
        'squad_requests[0][candidate_squad][unit_counts][archer]': 0,
        'squad_requests[0][candidate_squad][unit_counts][light]': 0,
        'squad_requests[0][candidate_squad][unit_counts][marcher]': 0,
        'squad_requests[0][candidate_squad][unit_counts][heavy]': 0,
        'squad_requests[0][candidate_squad][unit_counts][knight]': 0,
        'squad_requests[0][candidate_squad][carry_max]': carryCapacity,
        'h': csrfToken
    };
    const bodyPayload = new URLSearchParams(payload).toString();
    const refererUrl = page.url(); 

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
                try { return JSON.parse(text); } catch(e) { return { error: 'JSON Error', raw: text }; }
            } catch (e) {
                return { error: 'Fetch error: ' + e.message };
            }
        }
    `, { url, bodyString: bodyPayload, referer: refererUrl });

    if (result && result.response && result.response.villages && result.response.villages[config.villageId]) {
        return result.response.villages[config.villageId] || null;
    }
    return null;
}

module.exports = { execute };