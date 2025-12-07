// src/main/automation_modules/state_extractor.cjs (CORRIGIDO PARA BYTENODE)
console.log('[StateExtractor] Módulo carregado.');
const { sleep, randomWait } = require('../utils/helpers.cjs');

async function fetchScavengeData(page, villageId) {
    try {
        // **CORREÇÃO 1: jQuery AJAX via string**
        const villageObject = await page.evaluate(`
            async (vid) => {
                return new Promise(async (resolve, reject) => {
                    const fullUrl = 'game.php?village=' + vid + '&screen=place&mode=scavenge';
                    try {
                        // Usa jQuery da página se disponível, ou fetch
                        let htmlContent;
                        if (typeof jQuery !== 'undefined') {
                             const response = await jQuery.ajax({
                                url: fullUrl,
                                type: 'GET',
                                cache: false,
                                dataType: 'text'
                            });
                            htmlContent = response;
                        } else {
                             const resp = await fetch(fullUrl);
                             htmlContent = await resp.text();
                        }

                        if (!htmlContent) return reject('Conteúdo vazio.');

                        const objectMatch = htmlContent.match(/var\\s+village\\s+=\\s*(\\{[\\s\\S]*?\\})\\s*;/);
                        if (objectMatch && objectMatch[1]) {
                            try {
                                const jsString = '(' + objectMatch[1] + ')';
                                const villageData = eval(jsString);
                                return resolve(villageData);
                            } catch (e) {
                                return reject('Eval error: ' + e.message);
                            }
                        }
                        return reject('Objeto village não encontrado.');
                    } catch (e) {
                        reject('AJAX error: ' + (e.message || e));
                    }
                });
            }
        `, villageId);
        
        return villageObject;
    } catch (error) {
        console.error(`[StateExtractor] Erro scavenge data: ${error.message}`);
        return null;
    }
}

async function execute(page, sendStatus, config) {
    const accountId = config.accountId;
    const villageId = config.villageId;
    let mainUrl = ''; 

    console.log(`[StateExtractor-${accountId}] Iniciando extração...`);
    try {
        const targetUrlPart = `village=${villageId}&screen=main`;
        const currentUrl = page.url();

        if (!currentUrl.includes(targetUrlPart)) {
            const baseUrlMatch = currentUrl.match(/^(https?:\/\/[^\/]+)/);
            if (!baseUrlMatch) throw new Error(`Erro URL base.`);
            const baseUrl = baseUrlMatch[1];
            mainUrl = `${baseUrl}/game.php?village=${villageId}&screen=main`;
            await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForSelector('#buildings', { timeout: 15000 });
            await randomWait(1000, 3000);
        } else {
            mainUrl = currentUrl.split('?')[0] + `?village=${villageId}&screen=main`;
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForSelector('#buildings', { timeout: 15000 });
            await randomWait(500, 1500);
        }
        
        // **CORREÇÃO 2: game_data via string**
        let gameData = null;
        let attempts = 0;
        while (!gameData && attempts < 3) {
            attempts++;
            gameData = await page.evaluate("typeof window.game_data !== 'undefined' ? JSON.parse(JSON.stringify(window.game_data)) : null");
            if (gameData) break;
            if (attempts < 3) await sleep(1000 * attempts);
        }

        if (!gameData || !gameData.village || !gameData.player || !gameData.csrf) return null; 
        if (String(gameData.village.id) !== String(villageId)) return null; 

        // **CORREÇÃO 3: BuildingMain via string**
        const buildingsData = await page.evaluate("typeof window.BuildingMain !== 'undefined' && window.BuildingMain.buildings ? JSON.parse(JSON.stringify(window.BuildingMain.buildings)) : null");

        let completedMissions = [];
        let collectableRewards = [];
        const questUrl = `/game.php?village=${villageId}&screen=new_quests&ajax=quest_popup&tab=main-tab&quest=0`;
        const refererUrl = mainUrl;

        try {
            // **CORREÇÃO 4: Extração de quests complexa via string**
            // Como a função é grande, passamos tudo como string.
            const extractedData = await page.evaluate(`
                async ({ url, referer }) => {
                    function extractBalancedArray(text, startString) {
                        const startIndex = text.indexOf(startString);
                        if (startIndex === -1) return null;
                        const arrayStartIndex = text.indexOf('[', startIndex + startString.length);
                        if (arrayStartIndex === -1) return null;
                        let balance = 0;
                        let inString = false;
                        let arrayEndIndex = -1;
                        for (let i = arrayStartIndex; i < text.length; i++) {
                            const char = text[i];
                            if (char === '"' && text[i - 1] !== '\\\\') { inString = !inString; }
                            if (inString) continue;
                            if (char === '[') balance++;
                            else if (char === ']') balance--;
                            if (balance === 0) {
                                arrayEndIndex = i + 1;
                                break;
                            }
                        }
                        if (arrayEndIndex === -1) return null;
                        return text.substring(arrayStartIndex, arrayEndIndex);
                    }
                    
                    const missions = [];
                    const rewards = [];
                    try {
                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json, text/javascript, */*',
                                'TribalWars-Ajax': '1',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Referer': referer
                            }
                        });
                        if (!response.ok) return { missions, rewards, error: 'Network error' };
                        const data = await response.json();
                        if (!data || !data.response || !data.response.dialog) return { missions, rewards, error: 'Invalid JSON' };
                        
                        const html = data.response.dialog;
                        const questArrayString = extractBalancedArray(html, "Questlines.setQuests(");
                        const rewardArrayString = extractBalancedArray(html, "RewardSystem.setRewards(");

                        if (questArrayString) {
                            try {
                                const questlines = JSON.parse(questArrayString);
                                for (const questline of questlines) {
                                    if (questline.quests && Array.isArray(questline.quests)) {
                                        for (const quest of questline.quests) {
                                            if (quest.finished === true && quest.id) {
                                                missions.push({ reward_id: String(quest.id) });
                                            }
                                        }
                                    }
                                }
                            } catch (e) {}
                        }

                        if (rewardArrayString) {
                            try {
                                const rewardData = JSON.parse(rewardArrayString);
                                for (const rewardData_1 of rewardData) {
                                    if (rewardData_1.id && rewardData_1.status === 'unlocked') {
                                        rewards.push({ reward_id: String(rewardData_1.id) });
                                    }
                                }
                            } catch (e) {}
                        }
                        return { missions, rewards, error: null };
                    } catch (e) {
                        return { missions: [], rewards: [], error: e.message };
                    }
                }
            `, { url: questUrl, referer: refererUrl });

            if (!extractedData.error) {
                completedMissions = extractedData.missions;
                collectableRewards = extractedData.rewards;
            }
        } catch (questError) {
            console.warn(`[StateExtractor] Erro quests: ${questError.message}`);
        }

        const scavengeData = await fetchScavengeData(page, villageId);

        // **CORREÇÃO 5: Fila de Construção DOM via string**
        const constructionQueue = await page.evaluate(`
             () => {
                 const queueTable = document.getElementById('build_queue');
                 if (!queueTable) return [];
                 const rows = queueTable.querySelectorAll('tbody tr[class*="buildorder_"]');
                 const queue = [];
                 rows.forEach(row => {
                     try {
                         const buildingMatch = row.className.match(/buildorder_(\\w+)/);
                         if (!buildingMatch) return;
                         const buildingId = buildingMatch[1];
                         const nameLevelElement = row.querySelector('td:first-child');
                         let level = 0;
                         if (nameLevelElement) {
                             const rawText = nameLevelElement.innerText.trim();
                             const nameMatch = rawText.match(/^(.+)\\s*Nível\\s*(\\d+)/i);
                             if (nameMatch && nameMatch.length === 3) {
                                level = parseInt(nameMatch[2], 10);
                             }
                         }
                         if (buildingId !== 'unknown' && level > 0) {
                              queue.push({ buildingId: buildingId, level: level });
                         }
                     } catch(e) {}
                 });
                 return queue;
             }
        `);

        const gameState = {
            timestamp: Date.now(),
            villageId: gameData.village.id,
            villageName: gameData.village.name,
            village: gameData.village,
            player: gameData.player,
            buildingsData: buildingsData,
            constructionQueue: constructionQueue,
            csrfToken: gameData.csrf,
            completedMissions: completedMissions,
            collectableRewards: collectableRewards,
            scavengeInfo: scavengeData
        };

        // Normalização
        gameState.buildings = gameState.village?.buildings || {};
        gameState.resources = {
            wood: gameState.village?.wood ?? 0,
            clay: gameState.village?.stone ?? 0,
            iron: gameState.village?.iron ?? 0,
            storage: { max: gameState.village?.storage_max ?? 0 },
        };
        gameState.population = {
            current: gameState.village?.pop ?? 0,
            max: gameState.village?.pop_max ?? 0,
        };

        sendStatus('EM_EXECUÇÃO', 'Estado extraído.');
        return gameState;

    } catch (error) {
        console.error(`[StateExtractor-${accountId}] Erro:`, error);
        return null; 
    }
}

module.exports = { execute };