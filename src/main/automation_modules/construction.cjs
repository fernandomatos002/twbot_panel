// src/main/automation_modules/construction.cjs (CORRIGIDO PARA BYTENODE)
console.log('[Construction] Módulo carregado.');

const BUILDING_ID_MAP = {
    "timber": "wood", 
    "clay": "stone",
    "iron": "iron"
};

function translateBuildingId(inputId) {
    return BUILDING_ID_MAP[inputId] || inputId;
}

function checkResources(currentRes, cost) {
    return currentRes.wood >= (cost.wood || 0) && 
           currentRes.clay >= (cost.stone || 0) && 
           currentRes.iron >= (cost.iron || 0);
}

async function execute(page, sendStatus, config, gameState, apiService) {
    const accountId = config.accountId;
    const villageId = config.villageId;
    const csrfToken = gameState.csrfToken; 

    if (!csrfToken) return null;

    if (!gameState.buildingsData || !gameState.population || !gameState.resources) return null;

    const queue = gameState.constructionQueue || [];
    const MAX_QUEUE = 2; 
    if (queue.length >= MAX_QUEUE) return null;

    let nextItem = null;
    const currentRes = gameState.resources;
    const currentBuildings = gameState.buildings;
    const pop = gameState.population;
    
    // --- Lógica de Prioridade (Fazenda/Armazém) ---
    const popUsage = pop.current / pop.max;
    if (config.auto_farm_enabled && popUsage >= 0.80) {
        const farmCost = gameState.buildingsData.farm;
        if (farmCost && checkResources(currentRes, farmCost)) {
            const currentLevel = parseInt(currentBuildings.farm || "0", 10);
            nextItem = { id: 'farm', level: currentLevel + 1 };
        }
    }

    if (!nextItem && config.auto_warehouse_enabled && config.constructionListId) {
        const nextListItem = await getNextItemFromList(accountId, config.constructionListId, currentBuildings, queue, apiService);
        if (nextListItem) {
            const itemCost = gameState.buildingsData[nextListItem.id];
            if (itemCost) {
                const maxStorage = currentRes.storage.max;
                if (itemCost.wood > maxStorage || itemCost.stone > maxStorage || itemCost.iron > maxStorage) {
                    const storageCost = gameState.buildingsData.storage;
                    if (storageCost && checkResources(currentRes, storageCost)) {
                        const currentLevel = parseInt(currentBuildings.storage || "0", 10);
                        nextItem = { id: 'storage', level: currentLevel + 1 };
                    }
                }
            }
        }
    }

    if (!nextItem && config.constructionListId) {
        nextItem = await getNextItemFromList(accountId, config.constructionListId, currentBuildings, queue, apiService);
    }

    if (!nextItem) return null;
    
    const buildingId = nextItem.id;
    const buildingData = gameState.buildingsData ? gameState.buildingsData[buildingId] : null;

    if (buildingData && !checkResources(currentRes, buildingData)) {
        return null; 
    }
    
    // --- EXECUÇÃO FETCH ---
    try {
        const buildUrl = `/game.php?village=${villageId}&screen=main&ajaxaction=upgrade_building&type=main`;
        const refererUrl = page.url(); 
        const payload = {
            id: nextItem.id,
            force: "1",
            destroy: "0",
            source: villageId,
            h: csrfToken
        };
        const bodyPayload = new URLSearchParams(payload).toString();

        // **CORREÇÃO CRÍTICA PARA BYTENODE**: Passando a função como string
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
                    
                    if (!response.ok) {
                        return { error: 'Network error: ' + response.statusText };
                    }
                    return await response.json();
                } catch (e) {
                   return { error: 'Falha ao parsear resposta: ' + e.message };
                }
            }
        `, { url: buildUrl, bodyString: bodyPayload, referer: refererUrl });

        if (result?.response?.success && result?.game_data?.village) { 
            return result.game_data.village; 
        } else if (result?.response?.success) {
            return null;
        } else {
            console.warn(`[Construction-${accountId}] Falha:`, JSON.stringify(result));
            return null;
        }

    } catch (error) {
        console.error(`[Construction-${accountId}] Erro fatal: ${error.message}`);
    }
    return null;
}

async function getNextItemFromList(accountId, listId, currentBuildings, queue, apiService) {
    let constructionList;
    try {
        const response = await apiService.get(`/api/construction-lists/${listId}`);
        if (!response.data?.success || !response.data.list) throw new Error('Lista inválida.');
        constructionList = response.data.list;
        if (!constructionList.steps) return null;
    } catch (error) {
        return null;
    }

    for (const item of constructionList.steps) {
        const building = translateBuildingId(item.buildingId);
        const targetLevel = parseInt(item.level, 10);
        const currentLevel = parseInt(currentBuildings[building] || "0", 10);
        if (currentLevel < targetLevel) {
            const inQueue = queue.some(q => q.buildingId === building && q.level === (currentLevel + 1));
            if (inQueue) continue;
            return { id: building, level: currentLevel + 1 };
        }
    }
    return null;
}

module.exports = { execute };