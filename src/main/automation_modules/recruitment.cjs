// src/main/automation_modules/recruitment.cjs (CORRIGIDO PARA BYTENODE)
console.log('[Recruitment] Módulo carregado.');
const { randomWait } = require('../utils/helpers.cjs');
const cheerio = require('cheerio');

const RESOURCE_BUFFER_PERCENTAGE = 0.40;
const RECRUITABLE_UNITS = [
    'spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight'
];
const UNIT_BUILDING_MAP = {
    spear: 'barracks', sword: 'barracks', axe: 'barracks', archer: 'barracks',
    spy: 'stable', light: 'stable', marcher: 'stable', heavy: 'stable', knight: 'stable',
    ram: 'garage', catapult: 'garage'
};
const MAX_QUEUE_PER_BUILDING = 2;

const UNIT_COSTS = {
    spear:    { wood: 50,  stone: 30,  iron: 10,  pop: 1 },
    sword:    { wood: 30,  stone: 30,  iron: 70,  pop: 1 },
    axe:      { wood: 60,  stone: 30,  iron: 40,  pop: 1 },
    spy:      { wood: 50,  stone: 50,  iron: 20,  pop: 2 },
    light:    { wood: 125, stone: 100, iron: 250, pop: 4 },
    heavy:    { wood: 200, stone: 150, iron: 600, pop: 6 },
    ram:      { wood: 300, stone: 200, iron: 200, pop: 5 },
    catapult: { wood: 320, stone: 400, iron: 100, pop: 8 },
    archer:   { wood: 0, stone: 0, iron: 0, pop: 0 },
    marcher:  { wood: 0, stone: 0, iron: 0, pop: 0 },
    knight:   { wood: 0, stone: 0, iron: 0, pop: 0 }
};

function parseRecruitmentQueue(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const queueUnits = {};
    const queueLengths = { barracks: 0, stable: 0, garage: 0 };
    
    const queueIdsMap = {
        'trainqueue_barracks': 'barracks',
        'trainqueue_stable': 'stable',
        'trainqueue_garage': 'garage'
    };

    for (const [queueId, buildingName] of Object.entries(queueIdsMap)) {
        const rows = $(`tbody#${queueId} tr[id^="trainorder_"]`);
        queueLengths[buildingName] = rows.length;

        rows.each((i, row) => {
             try {
                 const unitElement = $(row).find('div.unit_sprite');
                 if (unitElement.length === 0) return;
                 const unitId = unitElement.attr('class').split(' ').pop();
                 if (!RECRUITABLE_UNITS.includes(unitId)) return;
                 const text = $(row).find('td').first().text().trim();
                 const amountMatch = text.match(/^(\d+)/);
                 if (unitId && amountMatch) {
                     queueUnits[unitId] = (queueUnits[unitId] || 0) + parseInt(amountMatch[1], 10);
                 }
            } catch (e) {}
        });
        
        const wrapperSelector = `div#${queueId.replace('trainqueue_', 'trainqueue_wrap_')}`;
        const inProductionRow = $(`${wrapperSelector} tr.lit`);
        if (inProductionRow.length > 0) {
            try {
                const unitElement = inProductionRow.find('div.unit_sprite');
                const unitId = unitElement.length > 0 ? unitElement.attr('class').split(' ').pop() : null;
                const text = inProductionRow.find('td').first().text().trim();
                const amountMatch = text.match(/^(\d+)/);
                if (unitId && amountMatch && RECRUITABLE_UNITS.includes(unitId)) {
                    queueUnits[unitId] = (queueUnits[unitId] || 0) + parseInt(amountMatch[1], 10);
                }
            } catch (e) {}
        }
    }
    return { units: queueUnits, lengths: queueLengths };
}

function calculateScavengingTroops(scavengeOptions) {
    const scavengingTroops = {};
    if (!scavengeOptions || typeof scavengeOptions !== 'object') return scavengingTroops;

    for (const optionId in scavengeOptions) {
        const option = scavengeOptions[optionId];
        if (option.scavenging_squad && option.scavenging_squad.unit_counts) {
            const units = option.scavenging_squad.unit_counts;
            for (const unitId in units) {
                if (units.hasOwnProperty(unitId) && RECRUITABLE_UNITS.includes(unitId)) {
                    scavengingTroops[unitId] = (scavengingTroops[unitId] || 0) + units[unitId];
                }
            }
        }
    }
    return scavengingTroops;
}

function calculateProportionalBatch(deficit, resources, unitCosts) {
    let totalCost = { wood: 0, clay: 0, iron: 0, pop: 0 };
    for (const unitId in deficit) {
         const amount = deficit[unitId];
         const cost = unitCosts[unitId];
         if (cost) {
             totalCost.wood += cost.wood * amount;
             totalCost.clay += cost.stone * amount; 
             totalCost.iron += cost.iron * amount;
             totalCost.pop += cost.pop * amount;
         }
    }
    if (totalCost.wood === 0 && totalCost.clay === 0 && totalCost.iron === 0) return {};

    let bottleneck = 1.0; 
    if (totalCost.wood > 0) bottleneck = Math.min(bottleneck, resources.wood / totalCost.wood);
    if (totalCost.clay > 0) bottleneck = Math.min(bottleneck, resources.clay / totalCost.clay);
    if (totalCost.iron > 0) bottleneck = Math.min(bottleneck, resources.iron / totalCost.iron);
    if (totalCost.pop > 0)  bottleneck = Math.min(bottleneck, resources.pop / totalCost.pop);
    if (bottleneck <= 0) return {};

    const batch = {};
    for (const unitId in deficit) {
         const amountToRecruit = Math.floor(deficit[unitId] * bottleneck);
         if (amountToRecruit > 0) batch[unitId] = amountToRecruit;
    }
    return batch;
}

async function execute(page, sendStatus, config, gameState) {
    const accountId = config.accountId;
    const villageId = config.villageId;
    const csrfToken = gameState.csrfToken; 
    
    const targetTemplate = config.recruitmentTemplate;
    if (!targetTemplate || Object.keys(targetTemplate).length === 0) return null;
    
    if (!gameState.village || !gameState.resources || !gameState.population) return null;
    
    const unitCosts = UNIT_COSTS;
    if (!gameState.scavengeInfo || !gameState.scavengeInfo.unit_counts_home) return null;
    const troopsHome = gameState.scavengeInfo.unit_counts_home;
    const troopsScavenging = calculateScavengingTroops(gameState.scavengeInfo.options);

    sendStatus('EM_EXECUÇÃO', 'Verificando fila de recrutamento...');
    const getRefererUrl = page.url(); 
    const url = `/game.php?village=${villageId}&screen=train`; 

    // **CORREÇÃO 1 (GET): Stringified function**
    const htmlContent = await page.evaluate(`
        async ({ url, referer }) => {
             try {
                 const res = await fetch(url, {
                     method: 'GET',
                     headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'TribalWars-Ajax': '1',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': referer 
                     }
                 });
                 if (!res.ok) return { error: 'Network error: ' + res.statusText };
                 
                 const contentType = res.headers.get("content-type");
                 if (contentType && contentType.includes("application/json")) {
                     const jsonData = await res.json();
                     return jsonData.content; 
                 } else {
                     return await res.text(); 
                 }
             } catch (e) {
                 return { error: 'Fetch error: ' + e.message };
             }
        }
    `, { url: url, referer: getRefererUrl });

    if (typeof htmlContent !== 'string' || (htmlContent && htmlContent.error)) {
         throw new Error(htmlContent.error || 'Erro na tela de recrutamento.');
    }
    
    const { units: queuedTroops, lengths: queueLengths } = parseRecruitmentQueue(htmlContent);
    
    try {
         const deficit = {};
         let needsRecruiting = false;
         
         for (const unitId of RECRUITABLE_UNITS) {
             const target = targetTemplate[unitId] || 0;
             if (target === 0) continue; 
             
             const home = troopsHome[unitId] || 0;
             const scavenging = troopsScavenging[unitId] || 0;
             const queued = queuedTroops[unitId] || 0;
             const totalEffective = home + scavenging + queued;
             const diff = target - totalEffective;

             if (diff > 0 && unitCosts[unitId] && unitCosts[unitId].pop > 0) { 
                 const building = UNIT_BUILDING_MAP[unitId];
                 if (building && queueLengths[building] >= MAX_QUEUE_PER_BUILDING) continue; 
                 deficit[unitId] = diff;
                 needsRecruiting = true;
             }
         }
         
         if (!needsRecruiting) return null;
         
         const r = gameState.resources;
         const p = gameState.population; 
         
         const maxStorage = r.storage.max;
         const buffer = maxStorage * RESOURCE_BUFFER_PERCENTAGE;
         const spendableResources = {
             wood: Math.max(0, r.wood - buffer),
             clay: Math.max(0, r.clay - buffer), 
             iron: Math.max(0, r.iron - buffer),
             pop: Math.max(0, p.max - p.current) 
         };

         const batchToRecruit = calculateProportionalBatch(deficit, spendableResources, unitCosts);
         if (Object.keys(batchToRecruit).length === 0) return null;
         
         const payload = {};
         for (const unitId in batchToRecruit) {
             payload[`units[${unitId}]`] = batchToRecruit[unitId];
         }
         payload['h'] = csrfToken;
         
         const recruitUrl = `/game.php?village=${villageId}&screen=train&ajaxaction=train&mode=train`;
         
         const baseUrlMatch = getRefererUrl.match(/^(https?:\/\/[^\/]+)/);
         if (!baseUrlMatch) throw new Error('Erro URL base.');
         const baseUrl = baseUrlMatch[1]; 
         const postRefererUrl = baseUrl + url;

         // **CORREÇÃO 2 (POST): Stringified function**
         const recruitResponse = await page.evaluate(`
            async ({ url, payload, referer }) => {
                 try {
                     const body = new URLSearchParams(payload).toString();
                     const res = await fetch(url, {
                         method: 'POST',
                         headers: {
                             'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                             'Accept': 'application/json, text/javascript, */*',
                             'TribalWars-Ajax': '1',
                             'X-Requested-With': 'XMLHttpRequest',
                             'Referer': referer 
                         },
                         body: body
                     });
                     if (!res.ok) return { error: 'Network error: ' + res.statusText };
                     
                     const text = await res.text();
                     if (text.startsWith('<')) {
                        return { error: 'Server returned HTML instead of JSON.' };
                     }
                     return JSON.parse(text);
                 } catch (e) {
                     return { error: 'Fetch error: ' + e.message };
                 }
            }
         `, { url: recruitUrl, payload: payload, referer: postRefererUrl });

         if (recruitResponse.error) throw new Error(recruitResponse.error);

         if (recruitResponse.success) {
             if (recruitResponse.game_data && recruitResponse.game_data.village) {
                 return recruitResponse.game_data.village;
             }
             return null;
         } else {
              console.warn(`[Recruitment-${accountId}] Falha:`, recruitResponse.msg);
              return null;
         }

    } catch (error) {
         console.error(`[Recruitment-${accountId}] Erro fatal:`, error);
         return null;
    }
}

module.exports = { execute };