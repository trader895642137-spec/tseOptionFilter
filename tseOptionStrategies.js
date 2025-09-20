
// https://github.com/turuslan/HackTimer/blob/master/HackTimer.min.js
(function(s) {
    var w, f = {}, o = window, l = console, m = Math, z = 'postMessage', x = 'HackTimer.js by turuslan: ', v = 'Initialisation failed', p = 0, r = 'hasOwnProperty', y = [].slice, b = o.Worker;
    function d() {
        do {
            p = 0x7FFFFFFF > p ? p + 1 : 0
        } while (f[r](p));
        return p
    }
    if (!/MSIE 10/i.test(navigator.userAgent)) {
        try {
            s = o.URL.createObjectURL(new Blob(["var f={},p=postMessage,r='hasOwnProperty';onmessage=function(e){var d=e.data,i=d.i,t=d[r]('t')?d.t:0;switch(d.n){case'a':f[i]=setInterval(function(){p(i)},t);break;case'b':if(f[r](i)){clearInterval(f[i]);delete f[i]}break;case'c':f[i]=setTimeout(function(){p(i);if(f[r](i))delete f[i]},t);break;case'd':if(f[r](i)){clearTimeout(f[i]);delete f[i]}break}}"]))
        } catch (e) {}
    }
    if (typeof (b) !== 'undefined') {
        try {
            w = new b(s);
            o.setInterval = function(c, t) {
                var i = d();
                f[i] = {
                    c: c,
                    p: y.call(arguments, 2)
                };
                w[z]({
                    n: 'a',
                    i: i,
                    t: t
                });
                return i
            }
            ;
            o.clearInterval = function(i) {
                if (f[r](i))
                    delete f[i],
                    w[z]({
                        n: 'b',
                        i: i
                    })
            }
            ;
            o.setTimeout = function(c, t) {
                var i = d();
                f[i] = {
                    c: c,
                    p: y.call(arguments, 2),
                    t: !0
                };
                w[z]({
                    n: 'c',
                    i: i,
                    t: t
                });
                return i
            }
            ;
            o.clearTimeout = function(i) {
                if (f[r](i))
                    delete f[i],
                    w[z]({
                        n: 'd',
                        i: i
                    })
            }
            ;
            w.onmessage = function(e) {
                var i = e.data, c, n;
                if (f[r](i)) {
                    n = f[i];
                    c = n.c;
                    if (n[r]('t'))
                        delete f[i]
                }
                if (typeof (c) == 'string')
                    try {
                        c = new Function(c)
                    } catch (k) {
                        l.log(x + 'Error parsing callback code string: ', k)
                    }
                if (typeof (c) == 'function')
                    c.apply(o, n.p)
            }
            ;
            w.onerror = function(e) {
                l.log(e)
            }
            ;
            l.log(x + 'Initialisation succeeded')
        } catch (e) {
            l.log(x + v);
            l.error(e)
        }
    } else
        l.log(x + v + ' - HTML5 Web Worker is not supported')
}
)('HackTimerWorker.min.js');




const CONSTS = {

    DEFAULTS: {
        MIN_VOL: 100 * 1000 * 1000,
    },

    COMMISSION_FACTOR: {
        OPTION: {
            BUY: 0.00103,
            SELL: 0.00103,
            SETTLEMENT: {
                BUY: 0.0005,
                SELL: 0.0055,
                TAX_FREE_SELL: 0.0005,
            }
        },
        STOCK: {
            BUY: 0.003712,
            SELL: 0.0088,
            TAX_FREE_SELL: 0.0005,
        },
        ETF: {
            BUY: 0.00116,
            SELL: 0.001875
        }
    },
    PRICE_TYPE: {
        BEST_PRICE: "BEST_PRICE",
        LAST_PRICE: "LAST_PRICE",
    },
    i18n: {
        BEST_PRICE: "سرخط",
        LAST_PRICE: "آخرین"
    }
}


let notifiedStrategyList = [];
let isSilentModeActive = false;
let tempIgnoredNotifList = [];
const ETF_LIST = ['اهرم', 'توان', 'موج', 'جهش'];
const isETF = (symbol) => ETF_LIST.some(_etfName => symbol === _etfName);

let prevListSymbolMap = {};

let generalConfig = {
    expectedProfitPerMonth: 1.05,
    minProfitToFilter: 0.04,
    BUCSSOptionListIgnorer: ({option, minVol}) => {
        return (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol || option.optionDetails.stockSymbolDetails.last < option.optionDetails.strikePrice)
    }
    ,
    BECSSOptionListIgnorer: ({option, minVol}) => {
        return (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol || option.optionDetails.stockSymbolDetails.last > option.optionDetails.strikePrice)
    },
    BUPSOptionListIgnorer: ({option, minVol}) => {
        return (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol || option.optionDetails.stockSymbolDetails.last < option.optionDetails.strikePrice)
    }
}

function calculateOptionMargin({priceSpot, // قیمت پایانی دارایی پایه (ریال)
strikePrice, // قیمت اعمال (ریال)
contractSize, // اندازه قرارداد
optionPremium, // قیمت فروش اختیار (ریال)
A=0.2, // ضریب A
B=0.1, // ضریب B
optionType="call"// "call" یا "put"
}) {

    function roundUpTo({margin, multiplier}) {
        return Math.ceil(margin / multiplier) * multiplier

    }
    // محاسبه مقدار در زیان بودن
    let intrinsicLoss = 0;
    if (optionType === "call") {
        intrinsicLoss = Math.max(0, strikePrice - priceSpot) * contractSize;
    } else if (optionType === "put") {
        intrinsicLoss = Math.max(0, priceSpot - strikePrice) * contractSize;
    }

    // مرحله ۱
    const marginStep1 = (priceSpot * A * contractSize) - intrinsicLoss;

    // مرحله ۲
    const marginStep2 = strikePrice * B * contractSize;

    // مرحله ۳: بیشینه مرحله ۱ و ۲ و گرد کردن
    const maxBaseMargin = Math.max(marginStep1, marginStep2);
    const roundedMargin = roundUpTo({
        margin: maxBaseMargin,
        multiplier: 10000
    });

    // مرحله ۴: افزودن قیمت فروش اختیار × اندازه قرارداد
    const finalMargin = roundedMargin + (optionPremium * contractSize);

    return {
        initila: roundedMargin,
        required: finalMargin
    }

}

const calcSumOfMargins = (options) => {
    return options.reduce( (_sum, option) => {

        return _sum + (calculateOptionMargin({
            priceSpot: option.optionDetails.stockSymbolDetails.last,
            strikePrice: option.optionDetails.strikePrice,
            contractSize: 1000,
            optionPremium: option.last,
            optionType: option.isCallOption ? "call" : "put"
        })?.required || 0)
    }
    , 0)

}

const showNotification = ({title, body, tag}) => {

    Notification.requestPermission().then(function(permission) {
        const notifTime = Date.now();

        if (permission !== "granted" || !document.hidden)
            return
        let notification = new Notification(title,{
            body,
            renotify: tag ? true : false,
            tag
        });

        console.log(body)

        notification.onclick = function() {
            window.parent.parent.focus();
        }
        ;
    })
}



const checkProfitsAnNotif = ({sortedStrategies}) => {

    if(isSilentModeActive){
        return 
    }

    const foundStrategy = sortedStrategies.find(strategy => strategy.expectedProfitNotif && strategy.profitPercent > 0);

    if (!foundStrategy)
        return

    const ignoreStrategyList = getIgnoreStrategyNames();
    const filterSymbolList = getFilterSymbols();

    const opportunities = sortedStrategies.filter(strategy => {
         if (!strategy.expectedProfitNotif)
            return

        if (tempIgnoredNotifList.find(_strategyName => _strategyName === strategy.name))
            return
        if (strategy.profitPercent <= 0)
            return
        if (filterSymbolList.length && !filterSymbolList.find(filteredSymbol => strategy.name.includes(filteredSymbol)))
            return

        const strategySymbols = strategy.positions.map(pos=>pos.symbol);
        
        if (ignoreStrategyList.find(ignoreStrategyObj => {
            if (!ignoreStrategyObj?.name)
                return false
            if (ignoreStrategyObj.type !== 'ALL' && ignoreStrategyObj.type !== strategy.strategyTypeTitle)
                    return false
            if(ignoreStrategyObj.name === strategy.name) return true
            
            return  strategySymbols.some(symbol=>symbol.includes(ignoreStrategyObj.name))
        }
        ))
            return
        return true
    }
    );

    if (!opportunities.length)
        return


    notifiedStrategyList = [].concat(opportunities);

    showNotification({
        title: `سود ${foundStrategy.strategyTypeTitle} بالای ${((foundStrategy.profitPercent) * 100).toFixed()} درصد`,
        body: `${foundStrategy.strategyTypeTitle} ${foundStrategy.name}`,
        tag: `profit`
    })

}

const getCommissionFactor = (_strategyPosition) => {
    return _strategyPosition.isOption ? CONSTS.COMMISSION_FACTOR.OPTION : CONSTS.COMMISSION_FACTOR.STOCK
}

const configsToHtmlTitle = ({strategyName, strategySubName, priceType, min_time_to_settlement, max_time_to_settlement, minStockPriceDistanceInPercent, maxStockPriceDistanceInPercent, minVol, customLabels}) => {

    const _priceType = CONSTS.i18n[priceType];
    const minToSettlement = min_time_to_settlement && ("minD:" + (min_time_to_settlement / 3600000 / 24).toFixed(0));
    const maxToSettlement = max_time_to_settlement && max_time_to_settlement !== Infinity && ("maxD:" + (max_time_to_settlement / 3600000 / 24).toFixed(0));
    const _minStockPriceDistanceInPercent = typeof minStockPriceDistanceInPercent !== 'undefined' && minStockPriceDistanceInPercent !== null && minStockPriceDistanceInPercent !== -Infinity && `coverMin:${((minStockPriceDistanceInPercent) * 100).toFixed(0)}%`;
    const _maxStockPriceDistanceInPercent = maxStockPriceDistanceInPercent && maxStockPriceDistanceInPercent !== Infinity && `coverMax:${((maxStockPriceDistanceInPercent) * 100).toFixed(0)}%`;

    return `
        <h5 style="margin:2px">${strategyName} ${strategySubName ? strategySubName : ''} ${_priceType}</h5> 
        <div  style="font-size: 12px;">${[_minStockPriceDistanceInPercent, _maxStockPriceDistanceInPercent].filter(Boolean).join(" - ")} ${customLabels?.length ? customLabels.map(labelInfo => labelInfo.label + ':' + labelInfo.value).join(" - ") : ''}</div>
        <div  style="font-size: 12px;">${[minToSettlement, maxToSettlement].filter(Boolean).join(" - ")}</div>`

}

const htmlStrategyListCreator = ({strategyList, title, expectedProfitNotif}) => {

    return `<div class="strategy-filter-list-cnt" data-base-strategy-type="${strategyList[0]?.strategyTypeTitle}" style="    height: 32vh;min-width:200px;    display: flex;    flex-direction: column;">
                <div style="padding:5px;padding-right:10px;padding-left:10px; height: 50px;flex-shrink: 0;${expectedProfitNotif ? 'color:green' : ''}">
                    ${title}
                </div>
                <div style="
                    display: flex;
                    flex-direction: column;
                    row-gap: 10px;
                    overflow: auto;
                    padding: 5px;
                    border: ${expectedProfitNotif && strategyList?.length ? '4px solid green' : '1px solid'};
                    flex-grow: 1;
                    ${expectedProfitNotif ? 'background: #f4fdf4;' : ''}
                    
                ">
                ${strategyList.map(_strategyObj => {
        return `
                    <div style="display:flex;column-gap: 5px;    font-size: 16px;">
                        <span class="strategy-name" data-base-strategy-type="${_strategyObj.strategyTypeTitle}">${_strategyObj.name}</span> 
                        <span style="margin-right:auto ;color:${_strategyObj.profitPercent > 0 ? '#005d00' : 'red'}">%${(_strategyObj.profitPercent * 100).toFixed(1)}</span>
                    </div>
                            
                    `
    }
    ).join('')}
            </div>
        
    </div>`

}
const parseStringToNumber = (str) => {
    let number = parseFloat(str);
    // ابتدا عدد را استخراج می‌کنیم
    if (str.endsWith('M') || str.endsWith('m')) {
        number *= 1e6;
        // در صورتی که با M ختم شود، به میلیون تبدیل می‌کنیم
    } else if (str.endsWith('B') || str.endsWith('b')) {
        number *= 1e9;
        // در صورتی که با B ختم شود، به میلیارد تبدیل می‌کنیم
    }
    return number;
}

const convertStringToInt = (stringNumber) => {
    if (!stringNumber)
        return NaN
    return parseInt(stringNumber.replaceAll(',', '').trim());
}

const createStrategyName = (options) => {
    let prevOptionSymBolWithoutDigits;
    return `${options.map(_option => {
        const symbolWithoutDigits = _option.symbol.replace(/[0-9]/g, '');
        if (prevOptionSymBolWithoutDigits === symbolWithoutDigits) {
            return _option.symbol.replace(symbolWithoutDigits, '');
        } else {
            prevOptionSymBolWithoutDigits = symbolWithoutDigits;
            return _option.symbol
        }
    }
    ).join('-')}`
}

const getAllPossibleStrategiesSorted = (_enrichedList) => {
    let allPossibleStrategies = _enrichedList.flatMap(_option => _option.allPossibleStrategies).filter(Boolean);

    allPossibleStrategies = allPossibleStrategies.sort( (strategyObjA, strategyObjB) => {
        if (strategyObjA.profitPercent < strategyObjB.profitPercent) {
            return 1;
        } else if (strategyObjA.profitPercent > strategyObjB.profitPercent) {
            return -1;
        }
        // a must be equal to b
        return 0;
    }
    )

    return allPossibleStrategies;

}

const isTaxFreeStock = (option) => {
    return ['اهرم', 'توان', 'موج', 'جهش', 'آساس'].some(taxFreeSymbol => option.optionDetails.stockSymbolDetails.symbol === taxFreeSymbol)
}

const getSettlementCommission = ({option, positionSide, settlementOn}) => {

    // settlementOn STOCK|OPTION

    if (option.isCallOption) {

        if (positionSide === 'BUY') {
            return settlementOn === 'OPTION' ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.BUY : CONSTS.COMMISSION_FACTOR.STOCK.BUY;
        } else if (positionSide === 'SELL') {
            const settlementOnOption = isTaxFreeStock(option) ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.TAX_FREE_SELL : CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.SELL;
            return settlementOn === 'OPTION' ? settlementOnOption : isETF(option.optionDetails.stockSymbolDetails.symbol) ? CONSTS.COMMISSION_FACTOR.ETF.SELL : CONSTS.COMMISSION_FACTOR.STOCK.SELL;
        }

    }

    if (option.isPutOption) {
        if (positionSide === 'BUY') {
            const settlementOnOption = isTaxFreeStock(option) ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.TAX_FREE_SELL : CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.SELL;
            return settlementOn === 'OPTION' ? settlementOnOption : CONSTS.COMMISSION_FACTOR.STOCK.SELL;

        } else if (positionSide === 'SELL') {
            return settlementOn === 'OPTION' ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.BUY : CONSTS.COMMISSION_FACTOR.STOCK.BUY;

        }

    }

}

// const getSettlementCommission = (option, positionSide) => {

//     if (option.isCallOption) {
//         return positionSide === 'BUY' ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.BUY : isTaxFreeStock(option) ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.TAX_FREE_SELL : CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.SELL
//     }

//     if (option.isPutOption) {
//         return positionSide === 'SELL' ? CONSTS.COMMISSION_FACTOR.STOCK.BUY : isTaxFreeStock(option) ? CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.TAX_FREE_SELL : CONSTS.COMMISSION_FACTOR.OPTION.SETTLEMENT.SELL
//     }

// }

const getPriceOfAsset = ({asset, priceType, sideType}) => {
   
    return priceType === CONSTS.PRICE_TYPE.LAST_PRICE ? asset.last : priceType === CONSTS.PRICE_TYPE.BEST_PRICE ? sideType === 'BUY' ? asset.bestSell : asset.bestBuy : 0;
}

const totalCostCalculator = ({buyOptions, buyStocks, sellOptions, priceType}) => {


    const totalBuyCost = [buyOptions, buyStocks].filter(Boolean).flatMap(list => list).reduce( (_totalBuyCost, asset) => {

        const price = getPriceOfAsset({
            asset,
            priceType,
            sideType: 'BUY'
        });

        if (!price)
            return (_totalBuyCost + Infinity)
        return _totalBuyCost + ((price) * (1 + getCommissionFactor(asset).BUY));
    }
    , 0);

    const totalSellCost = sellOptions.reduce( (_totalSellCost, asset) => {

        const price = getPriceOfAsset({
            asset,
            priceType,
            sideType: 'SELL'
        });

        if (!price)
            return (_totalSellCost + Infinity)

        return _totalSellCost + (price / (1 + getCommissionFactor(asset).SELL));
    }
    , 0);
    return totalSellCost - totalBuyCost
}

const totalSettlementGain = (positionInfoList) => {

    return positionInfoList.reduce( (_totalSettlementGain, positionInfo) => {

        const option = positionInfo.option;
        const positionSide = positionInfo.positionSide;
        const choosePriceType = positionInfo.choosePriceType;
        const strikePrice = option.optionDetails.strikePrice;
        const stockPrice = option.optionDetails.stockSymbolDetails.last;

        const settlementOn = choosePriceType === 'MIN' ? (strikePrice < stockPrice ? "OPTION" : "STOCK") : choosePriceType === 'MAX' ? (strikePrice > stockPrice ? "OPTION" : "STOCK") : "OPTION"
        const settlementPrice = settlementOn === "OPTION" ? strikePrice : stockPrice;
        const _getCommissionFactor = (_positionSide) => (1 + getSettlementCommission({
            option,
            positionSide: _positionSide,
            settlementOn
        }))

        if (option.isCallOption) {

            if (positionSide === 'BUY') {

                const commissionFactor = _getCommissionFactor(positionSide);

                return _totalSettlementGain - (settlementPrice * commissionFactor);

            } else if (positionSide === 'SELL') {

                const commissionFactor = _getCommissionFactor(positionSide);

                return _totalSettlementGain + (settlementPrice / commissionFactor)
            }
        } else if (option.isPutOption) {
            if (positionSide === 'BUY') {

                const commissionFactor = _getCommissionFactor(positionSide);

                return _totalSettlementGain + (settlementPrice / commissionFactor);

            } else if (positionSide === 'SELL') {

                const commissionFactor = _getCommissionFactor(positionSide);

                return _totalSettlementGain - (settlementPrice * commissionFactor)
            }

        }

    }
    , 0)

}

// const totalSettlementGain = ({ buyOption, sellOption, choosePriceType }) => {

//     if ((!buyOption || buyOption.isCallOption) && (!sellOption || sellOption.isCallOption)) {

//         const sellPrice = choosePriceType === 'MIN' ? Math.min(sellOption.optionDetails.strikePrice, sellOption.optionDetails.stockSymbolDetails.last) : sellOption.optionDetails.strikePrice;
//         const sellGainWithCommission = (sellPrice / (1 + getSettlementCommission({option:sellOption, positionSide:'SELL', settlementOn:"OPTION"})))

//         return sellGainWithCommission - (buyOption ? (buyOption.optionDetails.strikePrice * (1 + getSettlementCommission({option:buyOption, positionSide:'BUY', settlementOn:"OPTION"}))) : 0);

//     } else if ((!buyOption || buyOption.isPutOption) && (!sellOption || sellOption.isPutOption)) {
//         const buyPrice = choosePriceType === 'MAX' ? Math.max(sellOption.optionDetails.strikePrice, sellOption.optionDetails.stockSymbolDetails.last) : sellOption.optionDetails.strikePrice;

//         const buyCostWithCommission = buyPrice * (1 + getSettlementCommission({option:sellOption, positionSide:'SELL', settlementOn:"OPTION"}));
//         return (buyOption ? (buyOption.optionDetails.strikePrice * (1 + getSettlementCommission({option:buyOption, positionSide:'BUY', settlementOn:"OPTION"}))) : 0) - buyCostWithCommission

//     }

// }

const calcBOXStrategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = []
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                    return option


                const optionPrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                });

                if(optionPrice===0) return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => _option.symbol !== option.symbol && _option.symbol.startsWith('ض') && _option.vol > minVol && _option.optionDetails?.strikePrice > option.optionDetails?.strikePrice);

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, higherStrikeOption) => {



                    const higherStrikeOptionPrice = getPriceOfAsset({
                        asset: higherStrikeOption,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(higherStrikeOptionPrice===0) return _allPossibleStrategies


                    const sameLowStrikePut = optionListOfSameDate.find(__option => __option.symbol === option.symbol.replace('ض', 'ط') && (__option.last > 10 ? __option.vol > minVol : true) && __option.bestBuy);
                    const sameHighStrikePut = optionListOfSameDate.find(__option => __option.symbol === higherStrikeOption.symbol.replace('ض', 'ط') && (__option.last > 10 ? __option.vol > minVol : true) && __option.bestSell);

                    if (!sameLowStrikePut || !sameHighStrikePut)
                        return _allPossibleStrategies


                    const sameLowStrikePutPrice = getPriceOfAsset({
                        asset: sameLowStrikePut,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(sameLowStrikePutPrice===0) return _allPossibleStrategies



                    const sameHighStrikePutPrice = getPriceOfAsset({
                        asset: sameHighStrikePut,
                        priceType,
                        sideType: 'BUY'
                    });

                    if(sameHighStrikePutPrice===0) return _allPossibleStrategies

                   

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option, sameHighStrikePut],
                        sellOptions: [higherStrikeOption, sameLowStrikePut],
                        priceType
                    });
                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: higherStrikeOption,
                        positionSide: "SELL",
                            // choosePriceType: "MIN"
                    }, ]);
                    const profit = totalCostWithSign + totalOffsetGainWithSign;
                    

                    const profitPercent = profit / Math.abs(totalCostWithSign);

                    
                    const strategyObj = {
                        // TODO:remove option prop
                        option: {
                            ...option
                        },
                        positions:[option, sameHighStrikePut,higherStrikeOption,sameLowStrikePut],
                        strategyTypeTitle: "BOX",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, higherStrikeOption]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                // allPossibleStrategies = allPossibleStrategies.sort((strategyObjA, strategyObjB) => {
                //     if (strategyObjA.profitPercent < strategyObjB.profitPercent) {
                //         return 1;
                //     } else if (strategyObjA.profitPercent > strategyObjB.profitPercent) {
                //         return -1;
                //     }
                //     // a must be equal to b
                //     return 0;
                // }
                // )

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }
    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BOX",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BOX",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minVol
        })
    }

}


const calcBOX_BUPS_BECSStrategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = []
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol)
                    return option


                const optionPrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                });

                if(optionPrice===0) return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => _option.symbol !== option.symbol && _option.symbol.startsWith('ط') && _option.vol > minVol && _option.optionDetails?.strikePrice > option.optionDetails?.strikePrice);

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, higherStrikeOption) => {


                    const higherStrikeOptionPrice = getPriceOfAsset({
                        asset: higherStrikeOption,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(higherStrikeOptionPrice===0) return _allPossibleStrategies

                    const sameLowStrikeCall = optionListOfSameDate.find(__option => __option.symbol === option.symbol.replace('ط', 'ض') && (__option.last > 10 ? __option.vol > minVol : true) && __option.bestBuy);
                    const sameHighStrikeCall = optionListOfSameDate.find(__option => __option.symbol === higherStrikeOption.symbol.replace('ط', 'ض') && (__option.last > 10 ? __option.vol > minVol : true) && __option.bestSell);
                    
                    if (!sameLowStrikeCall || !sameHighStrikeCall)
                        return _allPossibleStrategies

                    const sameLowStrikeCallPrice = getPriceOfAsset({
                        asset: sameLowStrikeCall,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(sameLowStrikeCallPrice===0) return _allPossibleStrategies


                    const sameHighStrikeCallPrice = getPriceOfAsset({
                        asset: sameHighStrikeCall,
                        priceType,
                        sideType: 'BUY'
                    });

                    if(sameHighStrikeCallPrice===0) return _allPossibleStrategies


                    

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option, sameHighStrikeCall],
                        sellOptions: [higherStrikeOption, sameLowStrikeCall],
                        priceType
                    });
                   

                    const margin = 2*(higherStrikeOption.optionDetails.strikePrice - option.optionDetails.strikePrice)

                 

                    const settlementGainWithSign = totalSettlementGain([{
                        option:sameHighStrikeCall,
                        positionSide: "BUY"
                    }, {
                        option: sameLowStrikeCall,
                        positionSide: "SELL",
                            // choosePriceType: "MIN"
                    }, ]);

                    const profit = totalCostWithSign + settlementGainWithSign;
                    

                    const profitPercent = profit  /  Math.abs(margin - totalCostWithSign);

                    
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, higherStrikeOption,sameHighStrikeCall,sameLowStrikeCall],
                        strategyTypeTitle: "BOX_BUPS_BECS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, higherStrikeOption]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

              

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }
    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BOX_BUPS_BECS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BOX_BUPS_BECS",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minVol
        })
    }

}


const calcLongGUTS_STRANGLEStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=0, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol || option.optionDetails?.strikePrice >= option.optionDetails.stockSymbolDetails.last)
                    return option

                const putListWithHigherStrike = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrike.reduce( (_allPossibleStrategies, _option) => {

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option, _option],
                        sellOptions: [],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: _option,
                        positionSide: "BUY"
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(totalCostWithSign);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "LongGUTS_STRANGLE",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "LongGUTS_STRANGLE",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "LongGUTS_STRANGLE",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcShortGUTSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, callListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=0, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (callListIgnorer && callListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const putListWithHigherStrikePriceThanStock = optionListOfSameDate.filter(_option => {


                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false


                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= _option.optionDetails.stockSymbolDetails.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePriceThanStock.reduce( (_allPossibleStrategies, _option) => {

                    

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [],
                        sellOptions: [option, _option],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "SELL"
                    }, {
                        option: _option,
                        positionSide: "SELL"
                    }, ]);

                    const sumOfMargins = calcSumOfMargins([option, _option])

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / (Math.abs(totalCostWithSign) + sumOfMargins / 1000);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "SHORT_GUTS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "SHORT_GUTS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromOption2StrikeInPercent,
        maxStockPriceDistanceFromOption2StrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "SHORT_GUTS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromOption2StrikeInPercent !== 'undefined' && minStockPriceDistanceFromOption2StrikeInPercent !== null && minStockPriceDistanceFromOption2StrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromOption2StrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromOption2StrikeInPercent !== 'undefined' && maxStockPriceDistanceFromOption2StrikeInPercent !== null && maxStockPriceDistanceFromOption2StrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromOption2StrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcShortSTRANGLEStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, callListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromPutStrikeInPercent=-Infinity, maxStockPriceDistanceFromPutStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=0, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (callListIgnorer && callListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const putList = optionListOfSameDate.filter(_option => {

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice >= _option.optionDetails.stockSymbolDetails.last)
                        return false

                    const stockPricePutStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPricePutStrikeRatio > minStockPriceDistanceFromPutStrikeInPercent && stockPricePutStrikeRatio < maxStockPriceDistanceFromPutStrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putList.reduce( (_allPossibleStrategies, _option) => {

                 

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [],
                        sellOptions: [option, _option],
                        priceType
                    });

                    // const totalOffsetGainWithSign = totalSettlementGain([
                    //         {option, positionSide:"SELL"},
                    //         {option:_option, positionSide:"SELL"},
                    //     ]
                    // );

                    const totalOffsetGainWithSign = 0;

                    const sumOfMargins = calcSumOfMargins([option, _option])

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / (Math.abs(totalCostWithSign) + sumOfMargins / 1000);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "SHORT_STRANGLE",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "SHORT_STRANGLE",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromPutStrikeInPercent,
        maxStockPriceDistanceFromPutStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "SHORT_STRANGLE",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromPutStrikeInPercent !== 'undefined' && minStockPriceDistanceFromPutStrikeInPercent !== null && minStockPriceDistanceFromPutStrikeInPercent !== -Infinity && {
                label: "minToLow",
                value: `${((minStockPriceDistanceFromPutStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromPutStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromPutStrikeInPercent !== null && maxStockPriceDistanceFromPutStrikeInPercent !== Infinity && {
                label: "minToLow",
                value: `${((maxStockPriceDistanceFromPutStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcBUCSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=0, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    const lowStrikePrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                    });
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    const sarBeSar = option.optionDetails?.strikePrice + (lowStrikePrice - highStrikePrice);

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [_option],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: _option,
                        positionSide: "SELL",
                        choosePriceType: settlementGainChoosePriceType
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(totalCostWithSign);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "BUCS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUCS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUCS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}


const calcBUPSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, BUPSOptionListIgnorer=generalConfig.BUPSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUPSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

               

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط'))
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false
                    if (_option.vol < minVol)
                        return false
                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                     const stockPriceHigherStrikeRatio = (option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio < minStockPriceDistanceInPercent || stockPriceHigherStrikeRatio > maxStockPriceDistanceInPercent)
                        return _allPossibleStrategies

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [_option],
                        priceType
                    });

                    const margin = _option.optionDetails.strikePrice - option.optionDetails.strikePrice

                    const profit = totalCostWithSign

                    const profitPercent = profit / Math.abs(margin);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "BUPS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}


const calcBUPS_COLLARStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, BUPSOptionListIgnorer=generalConfig.BUPSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUPSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionPrice = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(optionPrice===0) return option
               

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط'))
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false
                    if (_option.vol < minVol)
                        return false
                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                    const _optionPrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(_optionPrice===0) return _allPossibleStrategies


                    const callOptionWithSameStrike = optionListOfSameDate.find(optionOfSameDate => {
                        return optionOfSameDate.isCallOption && optionOfSameDate.bestSell > 0 && (optionOfSameDate.optionDetails?.strikePrice === _option.optionDetails?.strikePrice)
                    }
                    );

                    if (!callOptionWithSameStrike) {
                        return _allPossibleStrategies
                    }


                    const callOptionWithSameStrikePrice = getPriceOfAsset({
                        asset: callOptionWithSameStrike,
                        priceType,
                        sideType: 'BUY'
                    });

                    if(callOptionWithSameStrikePrice===0) return _allPossibleStrategies

                    const stockPriceHigherStrikeRatio = (option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio < minStockPriceDistanceInPercent || stockPriceHigherStrikeRatio > maxStockPriceDistanceInPercent)
                        return _allPossibleStrategies



                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option,callOptionWithSameStrike],
                        sellOptions: [_option],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: _option,
                        positionSide: "SELL"
                    }, ]);

                    const margin = _option.optionDetails.strikePrice - option.optionDetails.strikePrice

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(margin);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option,callOptionWithSameStrike],
                        strategyTypeTitle: "BUPS_COLLAR",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUPS_COLLAR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUPS_COLLAR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}


const calcCALL_BUTT_CONDORStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUCS_BECS_diffStrikesRatio=0, MAX_BUCS_BECS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    

                    const sarBeSar = option.optionDetails?.strikePrice + (priceOfOptionWithLowStrike - highStrikePrice);

                    

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });
                    if(option2Price===0) return _allPossibleStrategies

                    const totalBUCS_CostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [option2],
                        priceType
                    });

                    const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: option2,
                        positionSide: "SELL"
                    }, ]);

                    const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let __allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies

                        const optionListWithHigherStrikePriceThanO3 = optionListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );
                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUCS_BECS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBECS_Strikes;

                            if (BUCS_BECS_diffStrikesRatio < MIN_BUCS_BECS_diffStrikesRatio || BUCS_BECS_diffStrikesRatio > MAX_BUCS_BECS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BECS_Gain = sellPrice - buyPrice;

                            const minProfitLossOfButterfly = (BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUCS_CostWithSign;

                            let maxGainOfButterfly;
                            if (BUCS_BECS_diffStrikesRatio > 1) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BECS_Gain = BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                                const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                                maxGainOfButterfly = BUCS_OffsetGain + BECS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BECS_Gain = BUCS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BECS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "CALL_BUTT_CONDOR",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "CALL_BUTT_CONDOR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "CALL_BUTT_CONDOR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}


const calcCALL_BUTTERFLYStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUCS_BECS_diffStrikesRatio=0, MAX_BUCS_BECS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isCallOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    

                    const sarBeSar = option.optionDetails?.strikePrice + (priceOfOptionWithLowStrike - highStrikePrice);

                    

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });
                    if(option2Price===0) return _allPossibleStrategies

                    const totalBUCS_CostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [option2],
                        priceType
                    });

                    const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: option2,
                        positionSide: "SELL"
                    }, ]);

                    const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let option3 = option2;


                    const callListWithHigherStrikePriceThanO3 = callListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );
                    let strategies = callListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                        


                        const option4Price = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });
                        if(option4Price===0) return ___allPossibleStrategies
                        const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                        const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                        if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                            return ___allPossibleStrategies

                        const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                        if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                            return ___allPossibleStrategies

                        // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                        if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                            return ___allPossibleStrategies

                        const sellPrice = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        const buyPrice = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });

                        const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                        const BUCS_BECS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBECS_Strikes;

                        if (BUCS_BECS_diffStrikesRatio < MIN_BUCS_BECS_diffStrikesRatio || BUCS_BECS_diffStrikesRatio > MAX_BUCS_BECS_diffStrikesRatio)
                            return ___allPossibleStrategies

                        const MAX_BECS_Gain = sellPrice - buyPrice;

                        const minProfitLossOfButterfly = (BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUCS_CostWithSign;

                        let maxGainOfButterfly;
                        if (BUCS_BECS_diffStrikesRatio > 1) {
                            let maxGainPrice = option3.optionDetails?.strikePrice;
                            const BECS_Gain = BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                            const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                            maxGainOfButterfly = BUCS_OffsetGain + BECS_Gain;

                        } else {
                            let maxGainPrice = option2.optionDetails?.strikePrice;

                            const BECS_Gain = BUCS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                            maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BECS_Gain;

                        }

                        let profitLossPresent

                        if (minProfitLossOfButterfly > 0) {
                            profitLossPresent = 1
                        } else {

                            profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                        }

                        if (profitLossPresent < minProfitLossRatio)
                            return ___allPossibleStrategies

                        const strategyObj = {
                            option: {
                                ...option
                            },
                            positions:[option, option2, option3, option4],
                            strategyTypeTitle: "CALL_BUTTERFLY",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, option3, option4]),
                            profitPercent: profitLossPresent
                        }

                        return ___allPossibleStrategies.concat([strategyObj])

                    }
                    , []);

                  

                    return _allPossibleStrategies.concat(strategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "CALL_BUTTERFLY",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "CALL_BUTTERFLY",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcCALL_CONDORStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUCS_BECS_diffStrikesRatio=0, MAX_BUCS_BECS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isCallOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    

                    const sarBeSar = option.optionDetails?.strikePrice + (priceOfOptionWithLowStrike - highStrikePrice);

                    

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });
                    if(option2Price===0) return _allPossibleStrategies

                    const totalBUCS_CostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [option2],
                        priceType
                    });

                    const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: option2,
                        positionSide: "SELL"
                    }, ]);

                    const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let __allPossibleStrategies = callListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        if(option3.symbol===option2.symbol) return ___allPossibleStrategies

                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies

                        const callListWithHigherStrikePriceThanO3 = callListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );
                        let strategies = callListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUCS_BECS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBECS_Strikes;

                            if (BUCS_BECS_diffStrikesRatio < MIN_BUCS_BECS_diffStrikesRatio || BUCS_BECS_diffStrikesRatio > MAX_BUCS_BECS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BECS_Gain = sellPrice - buyPrice;

                            const minProfitLossOfButterfly = (BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUCS_CostWithSign;

                            let maxGainOfButterfly;
                            if (BUCS_BECS_diffStrikesRatio > 1) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BECS_Gain = BUCS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                                const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                                maxGainOfButterfly = BUCS_OffsetGain + BECS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BECS_Gain = BUCS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BECS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "CALL_CONDOR",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "CALL_CONDOR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "CALL_CONDOR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcPUT_BUTTERFLYStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUPS_BEPS_diffStrikesRatio=0, MAX_BUPS_BEPS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionPrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                });

                if(optionPrice===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    const lowStrikePrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                    });
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    const sarBeSar = option.optionDetails?.strikePrice + (lowStrikePrice - highStrikePrice);

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies
                    

                    const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let option3 = option2;

                    const putListWithHigherStrikePriceThanO3 = putListWithHigherStrikePrice.filter(o => {
                        if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                            return false

                        if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                            return false

                        return true

                    }
                    );

                    let strategies = putListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                        const option4Price = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });

                        if(option4Price===0) return ___allPossibleStrategies

                        const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                        const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                        if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                            return ___allPossibleStrategies

                        const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                        if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                            return ___allPossibleStrategies

                        // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                        if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                            return ___allPossibleStrategies



                        const totalBEPS_CostWithSign = totalCostCalculator({
                            buyOptions: [option4],
                            sellOptions: [option3],
                            priceType
                        });

                        const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                            option: option4,
                            positionSide: "BUY"
                        }, {
                            option: option3,
                            positionSide: "SELL"
                        }, ]);

                        const buyPricePut1 = getPriceOfAsset({
                            asset: option,
                            priceType,
                            sideType: 'BUY'
                        });
                        const sellPricePut2 = getPriceOfAsset({
                            asset: option2,
                            priceType,
                            sideType: 'SELL'
                        });

                        const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                        const BUPS_BEPS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBEPS_Strikes;

                        if (BUPS_BEPS_diffStrikesRatio < MIN_BUPS_BEPS_diffStrikesRatio || BUPS_BEPS_diffStrikesRatio > MAX_BUPS_BEPS_diffStrikesRatio)
                            return ___allPossibleStrategies

                        const BUPS_OpenPositionGain =  (sellPricePut2 - buyPricePut1)
                        const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign  + totalBEPS_CostWithSign;
                        const MAX_BUPS_LossWithSign = BUPS_OpenPositionGain - diffOfBUPS_Strikes

                        const minProfitLossOfButterfly = (BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + MAX_BUPS_LossWithSign;

                        let maxGainOfButterfly;
                        if (BUPS_BEPS_diffStrikesRatio > 1) {
                            let maxGainPrice = option3.optionDetails?.strikePrice;
                            const BEPS_Gain = BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                            const BUPS_Gain =  BUPS_OpenPositionGain;

                            maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                        } else {
                            let maxGainPrice = option2.optionDetails?.strikePrice;

                            const BEPS_Gain = BUPS_BEPS_diffStrikesRatio *  MAX_BEPS_Gain

                            const BUPS_Gain =  BUPS_OpenPositionGain;

                            maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                        }

                        let profitLossPresent

                        if (minProfitLossOfButterfly > 0) {
                            profitLossPresent = 1
                        } else {

                            profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                        }

                        if (profitLossPresent < minProfitLossRatio)
                            return ___allPossibleStrategies

                        const strategyObj = {
                            option: {
                                ...option
                            },
                            positions:[option, option2, option3, option4],
                            strategyTypeTitle: "PUT_BUTTERFLY",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, option3, option4]),
                            profitPercent: profitLossPresent
                        }

                        return ___allPossibleStrategies.concat([strategyObj])

                    }
                    , []);

                    return _allPossibleStrategies.concat(strategies)


                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "PUT_BUTTERFLY",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "PUT_BUTTERFLY",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}


const calcPUT_CONDORStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUPS_BEPS_diffStrikesRatio=0, MAX_BUPS_BEPS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionPrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                });

                if(optionPrice===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    const lowStrikePrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                    });
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    const sarBeSar = option.optionDetails?.strikePrice + (lowStrikePrice - highStrikePrice);

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies
                    

                    const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let __allPossibleStrategies = putListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        if(option3.symbol===option2.symbol) return ___allPossibleStrategies

                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });

                        if(option3Price===0) return ___allPossibleStrategies

                        const putListWithHigherStrikePriceThanO3 = putListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );
                        let strategies = putListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            if(option4Price===0) return ___allPossibleStrategies

                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies



                            const totalBEPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const buyPricePut1 = getPriceOfAsset({
                                asset: option,
                                priceType,
                                sideType: 'BUY'
                            });
                            const sellPricePut2 = getPriceOfAsset({
                                asset: option2,
                                priceType,
                                sideType: 'SELL'
                            });

                            const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUPS_BEPS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBEPS_Strikes;

                            if (BUPS_BEPS_diffStrikesRatio < MIN_BUPS_BEPS_diffStrikesRatio || BUPS_BEPS_diffStrikesRatio > MAX_BUPS_BEPS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const BUPS_OpenPositionGain =  (sellPricePut2 - buyPricePut1)
                            const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign  + totalBEPS_CostWithSign;
                            const MAX_BUPS_LossWithSign = BUPS_OpenPositionGain - diffOfBUPS_Strikes

                            const minProfitLossOfButterfly = (BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + MAX_BUPS_LossWithSign;

                            let maxGainOfButterfly;
                            if (BUPS_BEPS_diffStrikesRatio > 1) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BEPS_Gain = BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                               
                                const BUPS_Gain = ( maxGainPrice< option2.optionDetails?.strikePrice ?  (maxGainPrice - option2.optionDetails?.strikePrice) : 0) + BUPS_OpenPositionGain;

                                maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BEPS_Gain = BUPS_BEPS_diffStrikesRatio * (MAX_BEPS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                const BUPS_Gain =  BUPS_OpenPositionGain;

                                maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "PUT_CONDOR",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "PUT_CONDOR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "PUT_CONDOR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcREVERSE_IRON_BUTTERFLYStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName, BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, minStockPriceDistanceFromLowerStrikeInPercent=-Infinity, maxStockPriceDistanceFromLowerStrikeInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {

                    const totalBUCS_CostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [option2],
                        priceType
                    });

                    const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: option2,
                        positionSide: "SELL"
                    }, ]);

                    const putWithSameStrikeOfOption1 = optionListOfSameDate.find(_option => _option.isPutOption && (_option.optionDetails?.strikePrice === option.optionDetails?.strikePrice));

                    if (!putWithSameStrikeOfOption1)
                        return _allPossibleStrategies

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const putListWithLowerStrikePrice = optionListOfSameDate.filter(_option => {

                        if (_option.symbol === putWithSameStrikeOfOption1.symbol || _option.isCallOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice > putWithSameStrikeOfOption1.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        const stockPriceLowerStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                        if (stockPriceLowerStrikeRatio < minStockPriceDistanceFromLowerStrikeInPercent || stockPriceLowerStrikeRatio > maxStockPriceDistanceFromLowerStrikeInPercent) {
                            return false
                        }

                        return true

                    }
                    );

                    let __allPossibleStrategies = putListWithLowerStrikePrice.reduce( (___allPossibleStrategies, put2) => {

                        const totalBEPS_CostWithSign = totalCostCalculator({
                            buyOptions: [putWithSameStrikeOfOption1],
                            sellOptions: [put2],
                            priceType
                        });

                        const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                            option: putWithSameStrikeOfOption1,
                            positionSide: "BUY"
                        }, {
                            option: put2,
                            positionSide: "SELL"
                        }, ]);

                        const maxRightProfit = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + totalBEPS_CostWithSign;
                        const maxLeftProfit = totalBEPS_CostWithSign + totalBEPS_SettlementGainWithSign + totalBUCS_CostWithSign;

                        const totalCost = totalBUCS_CostWithSign + totalBEPS_CostWithSign

                        if (showLeftRightProfitType === "LEFT&RIGHT") {
                            if (maxRightProfit < 0 || maxLeftProfit < 0) {
                                return ___allPossibleStrategies
                            }

                            profitLossPresent = Math.min(maxLeftProfit, maxRightProfit) / Math.abs(totalCost)

                        }
                        if (showLeftRightProfitType === "LEFT") {
                           
                            if (maxLeftProfit < 0) {
                                return ___allPossibleStrategies
                            }

                            profitLossPresent = maxLeftProfit / Math.abs(totalCost)

                        }
                        if (showLeftRightProfitType === "RIGHT") {
                            if (maxLeftProfit < 0) {
                                return ___allPossibleStrategies
                            }

                            profitLossPresent = maxRightProfit / Math.abs(totalCost)

                        }

                        const strategyObj = {
                            option: {
                                ...option
                            },
                            positions:[option, option2, putWithSameStrikeOfOption1, put2],
                            strategyTypeTitle: "REVERSE_IRON_BUTTERFLY",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, putWithSameStrikeOfOption1, put2]),
                            profitPercent: profitLossPresent
                        }

                        return ___allPossibleStrategies.concat([strategyObj])

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "REVERSE_IRON_BUTTERFLY",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "REVERSE_IRON_BUTTERFLY",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcIRON_BUTTERFLY_BUCS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUCS_BEPS_diffStrikesRatio=0, MAX_BUCS_BEPS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isCallOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( !_option.isPutOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );
                    let option3 =  putListWithHigherStrikePrice.find(put=>put.optionDetails?.strikePrice===option2.optionDetails?.strikePrice);
                    if(!option3) return _allPossibleStrategies
                    const option3Price = getPriceOfAsset({
                        asset: option3,
                        priceType,
                        sideType: 'SELL'
                    });
                    if(option3Price===0) return _allPossibleStrategies


                    const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                    if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                        return _allPossibleStrategies
                    }

                    const optionListWithHigherStrikePriceThanO3 = putListWithHigherStrikePrice.filter(o => {
                        if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                            return false
                        if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                            return false

                        if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                            return false

                        return true

                    }
                    );


                       

                    let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                        


                        const option4Price = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });
                        if(option4Price===0) return ___allPossibleStrategies
                        const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                        const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                        if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                            return ___allPossibleStrategies

                        const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                        if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                            return ___allPossibleStrategies

                        // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                        if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                            return ___allPossibleStrategies

                        const sellPrice = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        const buyPrice = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });

                        const totalBUCS_CostWithSign = totalCostCalculator({
                            buyOptions: [option],
                            sellOptions: [option2],
                            priceType
                        });
                        const totalBEPS_CostWithSign = totalCostCalculator({
                            buyOptions: [option4],
                            sellOptions: [option3],
                            priceType
                        });

                        const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                            option,
                            positionSide: "BUY"
                        }, {
                            option: option2,
                            positionSide: "SELL"
                        }, ]);

                        const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                            option: option4,
                            positionSide: "BUY"
                        }, {
                            option: option3,
                            positionSide: "SELL"
                        }, ]);

                        const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                        const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                        const BUCS_BEPS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBEPS_Strikes;

                        if (BUCS_BEPS_diffStrikesRatio < MIN_BUCS_BEPS_diffStrikesRatio || BUCS_BEPS_diffStrikesRatio > MAX_BUCS_BEPS_diffStrikesRatio)
                            return ___allPossibleStrategies

                        const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign +  totalBEPS_CostWithSign;

                        const minProfitLossOfButterfly = (BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + totalBUCS_CostWithSign;

                        let maxGainOfButterfly;
                        if (diffOfBUCS_Strikes > diffOfBEPS_Strikes) {
                            let maxGainPrice = option3.optionDetails?.strikePrice;
                            const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                            // TODO: offsetGainByGivenPrice Calculator function
                            const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                            maxGainOfButterfly = BUCS_OffsetGain + BEPS_Gain;

                        } else {
                            let maxGainPrice = option2.optionDetails?.strikePrice;

                            const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * (MAX_BEPS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                            maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BEPS_Gain;

                        }

                        let profitLossPresent

                        if (minProfitLossOfButterfly > 0) {
                            profitLossPresent = 1
                        } else {

                            profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                        }

                        if (profitLossPresent < minProfitLossRatio)
                            return ___allPossibleStrategies

                        const strategyObj = {
                            option: {
                                ...option
                            },
                            positions:[option, option2, option3, option4],
                            strategyTypeTitle: "IRON_BUTTERFLY_BUCS",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, option3, option4]),
                            profitPercent: profitLossPresent
                        }

                        return ___allPossibleStrategies.concat([strategyObj])

                    }
                    , []);


                    return _allPossibleStrategies.concat(strategies)



                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_BUTTERFLY_BUCS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_BUTTERFLY_BUCS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}


const calcIRON_CONDOR_BUCS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUCS_BEPS_diffStrikesRatio=0, MAX_BUCS_BEPS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( _option.isCallOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );

                    let __allPossibleStrategies = putListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        if(option3.optionDetails?.strikePrice===option2.optionDetails?.strikePrice) return ___allPossibleStrategies

                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies


                        const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                        if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                            return ___allPossibleStrategies
                        }

                        const optionListWithHigherStrikePriceThanO3 = putListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false
                            if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );




                       

                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const totalBUCS_CostWithSign = totalCostCalculator({
                                buyOptions: [option],
                                sellOptions: [option2],
                                priceType
                            });
                            const totalBEPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                                option,
                                positionSide: "BUY"
                            }, {
                                option: option2,
                                positionSide: "SELL"
                            }, ]);

                            const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                            const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUCS_BEPS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBEPS_Strikes;

                            if (BUCS_BEPS_diffStrikesRatio < MIN_BUCS_BEPS_diffStrikesRatio || BUCS_BEPS_diffStrikesRatio > MAX_BUCS_BEPS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign +  totalBEPS_CostWithSign;

                            const minProfitLossOfButterfly = (BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + totalBUCS_CostWithSign;

                            let maxGainOfButterfly;
                            if (diffOfBUCS_Strikes > diffOfBEPS_Strikes) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                                // TODO: offsetGainByGivenPrice Calculator function
                                const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                                maxGainOfButterfly = BUCS_OffsetGain + BEPS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * (MAX_BEPS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BEPS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "IRON_CONDOR_BUCS",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_CONDOR_BUCS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_CONDOR_BUCS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcIRON_BUTT_CONDOR_BUCS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUCS_BEPS_diffStrikesRatio=0, MAX_BUCS_BEPS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = callListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( _option.isCallOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );

                    let __allPossibleStrategies = putListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {


                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies


                        const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                        if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                            return ___allPossibleStrategies
                        }

                        const optionListWithHigherStrikePriceThanO3 = putListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false
                            if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );




                       

                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const totalBUCS_CostWithSign = totalCostCalculator({
                                buyOptions: [option],
                                sellOptions: [option2],
                                priceType
                            });
                            const totalBEPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBUCS_SettlementGainWithSign = totalSettlementGain([{
                                option,
                                positionSide: "BUY"
                            }, {
                                option: option2,
                                positionSide: "SELL"
                            }, ]);

                            const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const diffOfBUCS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                            const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUCS_BEPS_diffStrikesRatio = diffOfBUCS_Strikes / diffOfBEPS_Strikes;

                            if (BUCS_BEPS_diffStrikesRatio < MIN_BUCS_BEPS_diffStrikesRatio || BUCS_BEPS_diffStrikesRatio > MAX_BUCS_BEPS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign +  totalBEPS_CostWithSign;

                            const minProfitLossOfButterfly = (BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + totalBUCS_CostWithSign;

                            let maxGainOfButterfly;
                            if (diffOfBUCS_Strikes > diffOfBEPS_Strikes) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                                // TODO: offsetGainByGivenPrice Calculator function
                                const BUCS_OffsetGain = (Math.min(maxGainPrice, option2.optionDetails?.strikePrice) - option.optionDetails?.strikePrice) + totalBUCS_CostWithSign;

                                maxGainOfButterfly = BUCS_OffsetGain + BEPS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BEPS_Gain = BUCS_BEPS_diffStrikesRatio * (MAX_BEPS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly = totalBUCS_SettlementGainWithSign + totalBUCS_CostWithSign + BEPS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "IRON_BUTTERFLY",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_BUTT_CONDOR_BUCS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_BUTT_CONDOR_BUCS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcIRON_BUTTERFLY_BUPS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUPS_BECS_diffStrikesRatio=0, MAX_BUPS_BECS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                // if (BUCSSOptionListIgnorer({
                //     option,
                //     minVol
                // }))
                //     return option

                if (!option.optionDetails?.stockSymbolDetails || !option.isPutOption || option.vol < minVol)
                    return option

                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( _option.isPutOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );

                    let option3 = callListWithHigherStrikePrice.find(call=>call.optionDetails?.strikePrice===option2.optionDetails?.strikePrice);
                    if(!option3) return _allPossibleStrategies

                    const option3Price = getPriceOfAsset({
                        asset: option3,
                        priceType,
                        sideType: 'SELL'
                    });
                    if(option3Price===0) return _allPossibleStrategies


                    const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                    if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                        return _allPossibleStrategies
                    }



                    const optionListWithHigherStrikePriceThanO3 = callListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false
                            if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                    );  




                       

                    let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                        


                        const option4Price = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });
                        if(option4Price===0) return ___allPossibleStrategies
                        const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                        const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                        if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                            return ___allPossibleStrategies

                        const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                        if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                            return ___allPossibleStrategies

                        // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                        if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                            return ___allPossibleStrategies

                        const sellPrice = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        const buyPrice = getPriceOfAsset({
                            asset: option4,
                            priceType,
                            sideType: 'BUY'
                        });

                        const totalBUPS_CostWithSign = totalCostCalculator({
                            buyOptions: [option],
                            sellOptions: [option2],
                            priceType
                        });
                        const totalBECS_CostWithSign = totalCostCalculator({
                            buyOptions: [option4],
                            sellOptions: [option3],
                            priceType
                        });

                        const totalBUPS_SettlementGainWithSign = totalSettlementGain([{
                            option,
                            positionSide: "BUY"
                        }, {
                            option: option2,
                            positionSide: "SELL"
                        }, ]);

                        const totalBECS_SettlementGainWithSign = totalSettlementGain([{
                            option: option4,
                            positionSide: "BUY"
                        }, {
                            option: option3,
                            positionSide: "SELL"
                        }, ]);

                        const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                        const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                        const BUPS_BECS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBECS_Strikes;

                        if (BUPS_BECS_diffStrikesRatio < MIN_BUPS_BECS_diffStrikesRatio || BUPS_BECS_diffStrikesRatio > MAX_BUPS_BECS_diffStrikesRatio)
                            return ___allPossibleStrategies

                        const MAX_BECS_Gain =  totalBECS_CostWithSign;

                        const minProfitLossOfButterfly = (BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUPS_CostWithSign + totalBUPS_SettlementGainWithSign;

                        let maxGainOfButterfly;
                        if (diffOfBUPS_Strikes > diffOfBECS_Strikes) {
                            let maxGainPrice = option3.optionDetails?.strikePrice;
                            const BECS_Gain = BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                            // TODO: offsetGainByGivenPrice Calculator function
                            const BUPS_OffsetGain =  totalBUPS_CostWithSign;

                            maxGainOfButterfly = BUPS_OffsetGain + BECS_Gain;

                        } else {
                            let maxGainPrice = option2.optionDetails?.strikePrice;

                            const BECS_Gain = BUPS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                            maxGainOfButterfly =  totalBUPS_CostWithSign + BECS_Gain;

                        }

                        let profitLossPresent

                        if (minProfitLossOfButterfly > 0) {
                            profitLossPresent = 1
                        } else {

                            profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                        }

                        if (profitLossPresent < minProfitLossRatio)
                            return ___allPossibleStrategies

                        const strategyObj = {
                            option: {
                                ...option
                            },
                            positions:[option, option2, option3, option4],
                            strategyTypeTitle: "IRON_BUTTERFLY_BUPS",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, option3, option4]),
                            profitPercent: profitLossPresent
                        }

                        return ___allPossibleStrategies.concat([strategyObj])

                    }
                    , []);

                    return _allPossibleStrategies.concat(strategies)


                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_BUTTERFLY_BUPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_BUTTERFLY_BUPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcIRON_CONDOR_BUPS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUPS_BECS_diffStrikesRatio=0, MAX_BUPS_BECS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                // if (BUCSSOptionListIgnorer({
                //     option,
                //     minVol
                // }))
                //     return option

                if (!option.optionDetails?.stockSymbolDetails || !option.isPutOption || option.vol < minVol)
                    return option

                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( _option.isPutOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );

                    let __allPossibleStrategies = callListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        if(option3.optionDetails?.strikePrice === option2.optionDetails?.strikePrice) return ___allPossibleStrategies

                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies


                        const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                        if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                            return ___allPossibleStrategies
                        }

                        const optionListWithHigherStrikePriceThanO3 = callListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false
                            if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );




                       

                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const totalBUPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option],
                                sellOptions: [option2],
                                priceType
                            });
                            const totalBECS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBUPS_SettlementGainWithSign = totalSettlementGain([{
                                option,
                                positionSide: "BUY"
                            }, {
                                option: option2,
                                positionSide: "SELL"
                            }, ]);

                            const totalBECS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                            const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUPS_BECS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBECS_Strikes;

                            if (BUPS_BECS_diffStrikesRatio < MIN_BUPS_BECS_diffStrikesRatio || BUPS_BECS_diffStrikesRatio > MAX_BUPS_BECS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BECS_Gain =  totalBECS_CostWithSign;

                            const minProfitLossOfButterfly = (BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUPS_CostWithSign + totalBUPS_SettlementGainWithSign;

                            let maxGainOfButterfly;
                            if (diffOfBUPS_Strikes > diffOfBECS_Strikes) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BECS_Gain = BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                                // TODO: offsetGainByGivenPrice Calculator function
                                const BUPS_OffsetGain = (maxGainPrice < option2.optionDetails?.strikePrice ?  ( maxGainPrice -  option2.optionDetails?.strikePrice ) : 0) + totalBUPS_CostWithSign;

                                maxGainOfButterfly = BUPS_OffsetGain + BECS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BECS_Gain = BUPS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly =  totalBUPS_CostWithSign + BECS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "IRON_CONDOR_BUPS",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_CONDOR_BUPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_CONDOR_BUPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcIRON_BUTT_CONDOR_BUPS_Strategies = (list, {priceType, settlementGainChoosePriceType="MIN", showLeftRightProfitType="LEFT&RIGHT", strategySubName,
     BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, 
     minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, 
     minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity,
     minStockPriceDistanceFromOption2StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption2StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption3StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption3StrikeInPercent=Infinity, 
     minStockPriceDistanceFromOption4StrikeInPercent=-Infinity, maxStockPriceDistanceFromOption4StrikeInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, MIN_BUPS_BECS_diffStrikesRatio=0, MAX_BUPS_BECS_diffStrikesRatio=Infinity, minProfitLossRatio=.7, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                // if (BUCSSOptionListIgnorer({
                //     option,
                //     minVol
                // }))
                //     return option

                if (!option.optionDetails?.stockSymbolDetails || !option.isPutOption || option.vol < minVol)
                    return option

                const priceOfOptionWithLowStrike = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'BUY'
                });

                if(priceOfOptionWithLowStrike===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromOption2StrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromOption2StrikeInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies

                    

                    // TODO: create lower/higher strike price filter function in utils to reuse 

                    const callListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                        if ( _option.isPutOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                            return false

                        if (!_option.optionDetails?.stockSymbolDetails?.last)
                            return false

                        

                        return true

                    }
                    );

                    let __allPossibleStrategies = callListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {


                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });
                        if(option3Price===0) return ___allPossibleStrategies


                        const stockPricePut1StrikeRatio = (option3.optionDetails.stockSymbolDetails.last / option3.optionDetails?.strikePrice) - 1;

                        if (stockPricePut1StrikeRatio < minStockPriceDistanceFromOption3StrikeInPercent || stockPricePut1StrikeRatio > maxStockPriceDistanceFromOption3StrikeInPercent) {
                            return ___allPossibleStrategies
                        }

                        const optionListWithHigherStrikePriceThanO3 = callListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false
                            if (o.optionDetails?.strikePrice === option2.optionDetails?.strikePrice)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );




                       

                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                           


                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });
                            if(option4Price===0) return ___allPossibleStrategies
                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockPriceDistanceFromOption4StrikeInPercent || stockPriceStrike4Ratio < minStockPriceDistanceFromOption4StrikeInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies

                            const sellPrice = getPriceOfAsset({
                                asset: option3,
                                priceType,
                                sideType: 'SELL'
                            });
                            const buyPrice = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            const totalBUPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option],
                                sellOptions: [option2],
                                priceType
                            });
                            const totalBECS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBUPS_SettlementGainWithSign = totalSettlementGain([{
                                option,
                                positionSide: "BUY"
                            }, {
                                option: option2,
                                positionSide: "SELL"
                            }, ]);

                            const totalBECS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;
                            const diffOfBECS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUPS_BECS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBECS_Strikes;

                            if (BUPS_BECS_diffStrikesRatio < MIN_BUPS_BECS_diffStrikesRatio || BUPS_BECS_diffStrikesRatio > MAX_BUPS_BECS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const MAX_BECS_Gain =  totalBECS_CostWithSign;

                            const minProfitLossOfButterfly = (BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain) + totalBUPS_CostWithSign + totalBUPS_SettlementGainWithSign;

                            let maxGainOfButterfly;
                            if (diffOfBUPS_Strikes > diffOfBECS_Strikes) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BECS_Gain = BUPS_BECS_diffStrikesRatio * MAX_BECS_Gain;
                                // TODO: offsetGainByGivenPrice Calculator function
                                const BUPS_OffsetGain = (maxGainPrice< option2.optionDetails?.strikePrice ?  ( maxGainPrice - option2.optionDetails?.strikePrice) : 0) + totalBUPS_CostWithSign;

                                maxGainOfButterfly = BUPS_OffsetGain + BECS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BECS_Gain = BUPS_BECS_diffStrikesRatio * (MAX_BECS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                maxGainOfButterfly =  totalBUPS_CostWithSign + BECS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "IRON_BUTT_CONDOR_BUPS",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "IRON_BUTT_CONDOR_BUPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "IRON_BUTT_CONDOR_BUPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}



const calcPUT_BUTT_CONDORStrategies = (list, {priceType, settlementGainChoosePriceType="MIN", strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minStockPriceDistanceFromSarBeSarInPercent=-Infinity, maxStockPriceDistanceFromSarBeSarInPercent=Infinity, MIN_BUPS_BEPS_diffStrikesRatio=0, MAX_BUPS_BEPS_diffStrikesRatio=Infinity, minStockStrike4DistanceInPercent=-Infinity, maxStockStrike4DistanceInPercent=Infinity, minStockMiddleDistanceInPercent=-Infinity, maxStockMiddleDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, minProfitLossRatio=.7, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionPrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                });

                if(optionPrice===0) return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {

                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent) {} else {
                        return false
                    }

                    const lowStrikePrice = getPriceOfAsset({
                        asset: option,
                        priceType,
                        sideType: 'BUY'
                    });
                    const highStrikePrice = getPriceOfAsset({
                        asset: _option,
                        priceType,
                        sideType: 'SELL'
                    });
                    const sarBeSar = option.optionDetails?.strikePrice + (lowStrikePrice - highStrikePrice);

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceSarBeSarRatio = (_option.optionDetails.stockSymbolDetails.last / sarBeSar) - 1;

                    if (stockPriceSarBeSarRatio > minStockPriceDistanceFromSarBeSarInPercent && stockPriceSarBeSarRatio < maxStockPriceDistanceFromSarBeSarInPercent) {} else {
                        return false
                    }

                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {


                    const option2Price = getPriceOfAsset({
                        asset: option2,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(option2Price===0) return _allPossibleStrategies
                    

                    const diffOfBUPS_Strikes = option2.optionDetails?.strikePrice - option.optionDetails?.strikePrice;

                    let __allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {


                        const option3Price = getPriceOfAsset({
                            asset: option3,
                            priceType,
                            sideType: 'SELL'
                        });

                        if(option3Price===0) return ___allPossibleStrategies

                        const optionListWithHigherStrikePriceThanO3 = optionListWithHigherStrikePrice.filter(o => {
                            if (o.symbol === option2.symbol || o.symbol === option3.symbol)
                                return false

                            if (o.optionDetails?.strikePrice <= option3.optionDetails?.strikePrice)
                                return false

                            return true

                        }
                        );
                        let strategies = optionListWithHigherStrikePriceThanO3.reduce( (___allPossibleStrategies, option4) => {

                            const option4Price = getPriceOfAsset({
                                asset: option4,
                                priceType,
                                sideType: 'BUY'
                            });

                            if(option4Price===0) return ___allPossibleStrategies

                            const middlePrice = option2.optionDetails?.strikePrice === option3.optionDetails?.strikePrice ? option2.optionDetails?.strikePrice : (option3.optionDetails?.strikePrice + option2.optionDetails?.strikePrice) / 2;

                            const stockPriceMiddleRatio = (option4.optionDetails.stockSymbolDetails.last / middlePrice) - 1;
                            if (stockPriceMiddleRatio > maxStockMiddleDistanceInPercent || stockPriceMiddleRatio < minStockMiddleDistanceInPercent)
                                return ___allPossibleStrategies

                            const stockPriceStrike4Ratio = (option4.optionDetails.stockSymbolDetails.last / option4.optionDetails?.strikePrice) - 1;

                            if (stockPriceStrike4Ratio > maxStockStrike4DistanceInPercent || stockPriceStrike4Ratio < minStockStrike4DistanceInPercent)
                                return ___allPossibleStrategies

                            // if (option.optionDetails.stockSymbolDetails.last  > option4.optionDetails?.strikePrice) return ___allPossibleStrategies
                            if (option4.optionDetails?.strikePrice < option2.optionDetails?.strikePrice)
                                return ___allPossibleStrategies



                            const totalBEPS_CostWithSign = totalCostCalculator({
                                buyOptions: [option4],
                                sellOptions: [option3],
                                priceType
                            });

                            const totalBEPS_SettlementGainWithSign = totalSettlementGain([{
                                option: option4,
                                positionSide: "BUY"
                            }, {
                                option: option3,
                                positionSide: "SELL"
                            }, ]);

                            const buyPricePut1 = getPriceOfAsset({
                                asset: option,
                                priceType,
                                sideType: 'BUY'
                            });
                            const sellPricePut2 = getPriceOfAsset({
                                asset: option2,
                                priceType,
                                sideType: 'SELL'
                            });

                            const diffOfBEPS_Strikes = option4.optionDetails?.strikePrice - option3.optionDetails?.strikePrice;

                            const BUPS_BEPS_diffStrikesRatio = diffOfBUPS_Strikes / diffOfBEPS_Strikes;

                            if (BUPS_BEPS_diffStrikesRatio < MIN_BUPS_BEPS_diffStrikesRatio || BUPS_BEPS_diffStrikesRatio > MAX_BUPS_BEPS_diffStrikesRatio)
                                return ___allPossibleStrategies

                            const BUPS_OpenPositionGain =  (sellPricePut2 - buyPricePut1)
                            const MAX_BEPS_Gain = totalBEPS_SettlementGainWithSign  + totalBEPS_CostWithSign;
                            const MAX_BUPS_LossWithSign = BUPS_OpenPositionGain - diffOfBUPS_Strikes

                            const minProfitLossOfButterfly = (BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain) + MAX_BUPS_LossWithSign;

                            let maxGainOfButterfly;
                            if (BUPS_BEPS_diffStrikesRatio > 1) {
                                let maxGainPrice = option3.optionDetails?.strikePrice;
                                const BEPS_Gain = BUPS_BEPS_diffStrikesRatio * MAX_BEPS_Gain;
                                const BUPS_Gain = (maxGainPrice < option2.optionDetails?.strikePrice ? ( maxGainPrice - option2.optionDetails?.strikePrice) : 0) + BUPS_OpenPositionGain;

                                maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                            } else {
                                let maxGainPrice = option2.optionDetails?.strikePrice;

                                const BEPS_Gain = BUPS_BEPS_diffStrikesRatio * (MAX_BEPS_Gain - (maxGainPrice > option3.optionDetails?.strikePrice ? (maxGainPrice - option3.optionDetails?.strikePrice) : 0));

                                const BUPS_Gain =  BUPS_OpenPositionGain;

                                maxGainOfButterfly = BUPS_Gain + BEPS_Gain;

                            }

                            let profitLossPresent

                            if (minProfitLossOfButterfly > 0) {
                                profitLossPresent = 1
                            } else {

                                profitLossPresent = Math.abs(maxGainOfButterfly) / (Math.abs(maxGainOfButterfly) + Math.abs(minProfitLossOfButterfly))
                            }

                            if (profitLossPresent < minProfitLossRatio)
                                return ___allPossibleStrategies

                            const strategyObj = {
                                option: {
                                    ...option
                                },
                                positions:[option, option2, option3, option4],
                                strategyTypeTitle: "PUT_BUTT_CONDOR",
                                expectedProfitNotif,
                                name: createStrategyName([option, option2, option3, option4]),
                                profitPercent: profitLossPresent
                            }

                            return ___allPossibleStrategies.concat([strategyObj])

                        }
                        , []);

                        return ___allPossibleStrategies.concat(strategies)

                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "PUT_BUTT_CONDOR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "PUT_BUTT_CONDOR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof minStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && minStockPriceDistanceFromSarBeSarInPercent !== null && minStockPriceDistanceFromSarBeSarInPercent !== 0 && {
                label: "minToSar",
                value: `${((minStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromSarBeSarInPercent !== 'undefined' && maxStockPriceDistanceFromSarBeSarInPercent !== null && maxStockPriceDistanceFromSarBeSarInPercent !== Infinity && {
                label: "maxToSar",
                value: `${((maxStockPriceDistanceFromSarBeSarInPercent) * 100).toFixed(0)}%`
            }, ].filter(Boolean),
            minVol
        })
    }

}

const calcBUCSRatioStrategies = (list, {priceType, strategySubName, maxBUCSCostSellOptionRatio=2, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return


                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    return stockPriceHigherStrikeRatio > minStockPriceDistanceInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceInPercent

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, option2) => {

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option],
                        sellOptions: [option2],
                        priceType
                    });
                    // TODO: should be MAX ?
                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: option2,
                        positionSide: "SELL"
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    let __allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (___allPossibleStrategies, option3) => {

                        // const highSarBeSar = option3.optionDetails.strikePrice + option3.last + profit;

                        // const highSarBeSarCurrentStockPriceRatio = (highSarBeSar / option.optionDetails.stockSymbolDetails.last) - 1;

                        // if (highSarBeSarCurrentStockPriceRatio < .2) return ___allPossibleStrategies

                        if (totalCostWithSign === Infinity)
                            return ___allPossibleStrategies

                        const BUCSCostSellOptionRatio = (-totalCostWithSign / option3.last);

                        if (BUCSCostSellOptionRatio > maxBUCSCostSellOptionRatio)
                            return ___allPossibleStrategies

                        const sarBeSarSell = (profit / BUCSCostSellOptionRatio) + option3.optionDetails.strikePrice + option3.last;

                        const highSarBeSarCalculator = () => {

                            return (-totalCostWithSign + option.optionDetails.strikePrice - (option3.last * BUCSCostSellOptionRatio) - (option3.optionDetails.strikePrice * BUCSCostSellOptionRatio)) / (-BUCSCostSellOptionRatio + 1)

                        }

                        let highSarBeSarCurrentStockPriceRatio;

                        if (sarBeSarSell >= option2.optionDetails.strikePrice) {
                            highSarBeSarCurrentStockPriceRatio = (sarBeSarSell / option.optionDetails.stockSymbolDetails.last) - 1;
                            if (highSarBeSarCurrentStockPriceRatio < .2)
                                return ___allPossibleStrategies

                        } else {

                            const highSarBeSarPrice = highSarBeSarCalculator();
                            highSarBeSarCurrentStockPriceRatio = (highSarBeSarPrice / option.optionDetails.stockSymbolDetails.last) - 1;

                            if (highSarBeSarCurrentStockPriceRatio < .2)
                                return ___allPossibleStrategies
                        }

                      

                        // if (totalCostWithSign < 0 && BUCSCostSellOptionRatio > 5) return ___allPossibleStrategies

                        return ___allPossibleStrategies.concat([{
                            option: {
                                ...option
                            },
                            positions:[option, option2, option3],
                            strategyTypeTitle: "BUCS Ratio",
                            expectedProfitNotif,
                            name: createStrategyName([option, option2, option3]),
                            profitPercent: highSarBeSarCurrentStockPriceRatio //0.8
                        }])
                    }
                    , []);

                    return _allPossibleStrategies.concat(__allPossibleStrategies)

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUCS Ratio",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUCS Ratio",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}

const calcBUCS_COLLAR_Strategies = (list, {priceType, expectedProfitPerMonth, strategySubName, BUCSSOptionListIgnorer=generalConfig.BUCSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BUCSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض') || _option.vol < minVol)
                        return
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return

                    if (!_option.optionDetails?.stockSymbolDetails?.last)
                        return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    return stockPriceHigherStrikeRatio > minStockPriceDistanceInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceInPercent

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                    const putOptionWithSameStrike = optionListOfSameDate.find(optionOfSameDate => {
                        return optionOfSameDate.isPutOption && optionOfSameDate.bestSell > 0 && (optionOfSameDate.optionDetails?.strikePrice === _option.optionDetails?.strikePrice)
                    }
                    );

                    if (!putOptionWithSameStrike) {
                        return _allPossibleStrategies
                    }

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [option, putOptionWithSameStrike],
                        sellOptions: [_option],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option,
                        positionSide: "BUY"
                    }, {
                        option: _option,
                        positionSide: "SELL"
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(totalCostWithSign);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option,putOptionWithSameStrike],
                        strategyTypeTitle: "BUCS_COLLAR",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUCS_COLLAR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUCS_COLLAR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}


const calcBEPS_COLLAR_Strategies = (list, {priceType, expectedProfitPerMonth, strategySubName, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (!option.isPutOption || option.vol < minVol)
                    return option


                const optionPrice = getPriceOfAsset({
                    asset: option,
                    priceType,
                    sideType: 'SELL'
                });

                if(optionPrice===0) return option

                const putListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.isPutOption || _option.vol < minVol)
                        return
                    if (_option.optionDetails?.strikePrice <= option.optionDetails?.strikePrice)
                        return

                    if(!_option.optionDetails?.stockSymbolDetails) return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    return stockPriceHigherStrikeRatio > minStockPriceDistanceInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceInPercent

                }
                );

                let allPossibleStrategies = putListWithHigherStrikePrice.reduce( (_allPossibleStrategies, buyingPut) => {

                    const buyingPutPrice = getPriceOfAsset({
                        asset: buyingPut,
                        priceType,
                        sideType: 'BUY'
                    });

                    if(buyingPutPrice===0) return _allPossibleStrategies

                    const callWithSameStrikeOfSellingPut = optionListOfSameDate.find(optionOfSameDate => {
                        return optionOfSameDate.isCallOption && optionOfSameDate.bestSell > 0 && (optionOfSameDate.optionDetails?.strikePrice === option.optionDetails?.strikePrice)
                    }
                    );

                    if (!callWithSameStrikeOfSellingPut) {
                        return _allPossibleStrategies
                    }

                    const callWithSameStrikeOfSellingPutPrice = getPriceOfAsset({
                        asset: callWithSameStrikeOfSellingPut,
                        priceType,
                        sideType: 'BUY'
                    });

                    if(callWithSameStrikeOfSellingPutPrice===0) return _allPossibleStrategies

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [callWithSameStrikeOfSellingPut, buyingPut],
                        sellOptions: [option],
                        priceType
                    });

                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option: callWithSameStrikeOfSellingPut,
                        positionSide: "BUY"
                    }, {
                        option: buyingPut,
                        positionSide: "BUY"
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(totalCostWithSign);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, buyingPut,callWithSameStrikeOfSellingPut],
                        strategyTypeTitle: "BEPS_COLLAR",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, buyingPut,callWithSameStrikeOfSellingPut]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BEPS_COLLAR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BEPS_COLLAR",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}



const calcCOVEREDStrategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionListOfStock] of Object.entries(optionsGroupedByStock)) {

        const _enrichedList = optionListOfStock.map(option => {

            if (!option.optionDetails?.stockSymbolDetails)
                return option

            const stockPriceStrikeRatio = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;

            if (!option.symbol.startsWith('ض') || option.vol < minVol || stockPriceStrikeRatio < minStockPriceDistanceInPercent || stockPriceStrikeRatio > maxStockPriceDistanceInPercent)
                return option

            const totalCostWithSign = totalCostCalculator({
                buyStocks: [option.optionDetails?.stockSymbolDetails],
                buyOptions: [],
                sellOptions: [option],
                priceType
            });
            const totalOffsetGainWithSign = totalSettlementGain([{
                option,
                positionSide: "SELL",
                choosePriceType: "MIN"
            }, ]);

            const profit = totalCostWithSign + totalOffsetGainWithSign;

            const profitPercent = profit / Math.abs(totalCostWithSign);
            const strategyObj = {
                option: {
                    ...option
                },
                positions:[option.optionDetails?.stockSymbolDetails, option],
                strategyTypeTitle: "COVERED",
                expectedProfitNotif,
                expectedProfitPerMonth,
                name: createStrategyName([option.optionDetails?.stockSymbolDetails, option]),
                profitPercent
            }

            return {
                ...option,
                allPossibleStrategies: [strategyObj]
            }

        }
        );

        enrichedList = enrichedList.concat(_enrichedList)

    }

    return {
        enrichedList,
        allStrategiesSorted: getAllPossibleStrategiesSorted(enrichedList),
        strategyName: "COVERED",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "COVERED",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}

const calcCOVERED_CONVERSION_Strategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionListOfStock] of Object.entries(optionsGroupedByStock)) {

        const _enrichedList = optionListOfStock.map(option => {

            if (!option.optionDetails?.stockSymbolDetails)
                return option

            const stockPriceStrikeRatio = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;

            if (!option.symbol.startsWith('ض') || option.vol < minVol || stockPriceStrikeRatio < minStockPriceDistanceInPercent || stockPriceStrikeRatio > maxStockPriceDistanceInPercent)
                return option

            const putOptionWithSameStrike = optionListOfStock.find(optionOfStock => {
                return optionOfStock.isPutOption && optionOfStock.optionDetails.date === option.optionDetails.date && optionOfStock.bestSell > 0 && (optionOfStock.optionDetails?.strikePrice === option.optionDetails?.strikePrice)
            }
            );

            if (!putOptionWithSameStrike) {
                return {
                    ...option,
                    allPossibleStrategies: []
                }
            }

            const totalCostWithSign = totalCostCalculator({
                buyStocks: [option.optionDetails?.stockSymbolDetails],
                buyOptions: [putOptionWithSameStrike],
                sellOptions: [option],
                priceType
            });
            const totalOffsetGainWithSign = totalSettlementGain([{
                option,
                positionSide: "SELL"
            }, ]);

            const profit = totalCostWithSign + totalOffsetGainWithSign;

            const profitPercent = profit / Math.abs(totalCostWithSign);
            const strategyObj = {
                option: {
                    ...option
                },
                positions:[option.optionDetails?.stockSymbolDetails, option,putOptionWithSameStrike],
                strategyTypeTitle: "CONVERSION",
                expectedProfitNotif,
                expectedProfitPerMonth,
                name: createStrategyName([option.optionDetails?.stockSymbolDetails, option]),
                profitPercent
            }

            return {
                ...option,
                allPossibleStrategies: [strategyObj]
            }

        }
        );

        enrichedList = enrichedList.concat(_enrichedList)

    }

    return {
        enrichedList,
        allStrategiesSorted: getAllPossibleStrategiesSorted(enrichedList),
        strategyName: "CONVERSION",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "CONVERSION",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}

const calcCOVERED_COLLAR_Strategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionListOfStock] of Object.entries(optionsGroupedByStock)) {

        const _enrichedList = optionListOfStock.map(option => {

            if (!option.optionDetails?.stockSymbolDetails)
                return option

            const stockPriceStrikeRatio = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;

            if (!option.symbol.startsWith('ض') || option.vol < minVol || stockPriceStrikeRatio < minStockPriceDistanceInPercent || stockPriceStrikeRatio > maxStockPriceDistanceInPercent)
                return option

            const putOptionListWithLowerStrike = optionListOfStock.filter(optionOfStock => {
                return optionOfStock.isPutOption && optionOfStock.optionDetails.date === option.optionDetails.date && optionOfStock.bestSell > 0 && (optionOfStock.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
            }
            );

            if (!putOptionListWithLowerStrike.length) {
                return {
                    ...option,
                    allPossibleStrategies: []
                }
            }

            const allPossibleStrategies = putOptionListWithLowerStrike.map(putOptionWithLowerStrike => {

                const totalCostWithSign = totalCostCalculator({
                    buyStocks: [option.optionDetails?.stockSymbolDetails],
                    buyOptions: [putOptionWithLowerStrike],
                    sellOptions: [option],
                    priceType
                });
                const totalOffsetGainWithSign = totalSettlementGain([{
                    option,
                    positionSide: "SELL",
                    choosePriceType: "MIN"
                }, ]);
                const minOffsetGainWithSign = totalSettlementGain([{
                    option: putOptionWithLowerStrike,
                    positionSide: "BUY"
                }, ]);

                const profit = totalCostWithSign + totalOffsetGainWithSign;
                const minProfit = totalCostWithSign + minOffsetGainWithSign;

                const profitPercent = profit / Math.abs(totalCostWithSign);
                const minProfitPercent = minProfit / Math.abs(totalCostWithSign);
                return strategyObj = {
                    option: {
                        ...option
                    },
                    positions:[option.optionDetails?.stockSymbolDetails, option, putOptionWithLowerStrike],
                    strategyTypeTitle: "COVERED_COLLAR",
                    expectedProfitNotif,
                    expectedProfitPerMonth,
                    name: createStrategyName([option.optionDetails?.stockSymbolDetails, option, putOptionWithLowerStrike]),
                    profitPercent: minProfitPercent
                }

            }
            )

            return {
                ...option,
                allPossibleStrategies
            }

        }
        );

        enrichedList = enrichedList.concat(_enrichedList)

    }

    return {
        enrichedList,
        allStrategiesSorted: getAllPossibleStrategiesSorted(enrichedList),
        strategyName: "COVERED_COLLAR",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "COVERED_COLLAR",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}

const calcBEPSStrategies = (list, {priceType, expectedProfitPerMonth, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol || option.optionDetails.stockSymbolDetails.last > option.optionDetails.strikePrice) {
                    return option
                }
                const stockPriceLowerStrikeRatio = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;

                if (stockPriceLowerStrikeRatio < minStockPriceDistanceInPercent || stockPriceLowerStrikeRatio > maxStockPriceDistanceInPercent) {
                    return option
                }

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false

                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [_option],
                        sellOptions: [option],
                        priceType
                    });

                    // TODO: should be MIN BUY ?
                    const totalOffsetGainWithSign = totalSettlementGain([{
                        option: _option,
                        positionSide: "BUY",
                        choosePriceType: "MAX"
                    }, {
                        option: option,
                        positionSide: "SELL",
                        choosePriceType: "MAX"
                    }, ]);

                    const profit = totalCostWithSign + totalOffsetGainWithSign;

                    const profitPercent = profit / Math.abs(totalCostWithSign);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "BEPS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BEPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BEPS",
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}

const calcBECSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName, BECSSOptionListIgnorer=generalConfig.BECSSOptionListIgnorer, min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceInPercent=-Infinity, maxStockPriceDistanceInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(option => {

                if (BECSSOptionListIgnorer({
                    option,
                    minVol
                }))
                    return option


                    // TODO:FIXME: LOWER STRIKE!
                const stockPriceHigherStrikeRatio = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;

                if (stockPriceHigherStrikeRatio < minStockPriceDistanceInPercent || stockPriceHigherStrikeRatio > maxStockPriceDistanceInPercent)
                    return option

                const optionListWithHigherStrikePrice = optionListOfSameDate.filter(_option => {
                    if (_option.symbol === option.symbol || !_option.symbol.startsWith('ض'))
                        return false
                    if (_option.optionDetails?.strikePrice < option.optionDetails?.strikePrice)
                        return false
                    if (_option.vol < minVol)
                        return false
                    return true

                }
                );

                let allPossibleStrategies = optionListWithHigherStrikePrice.reduce( (_allPossibleStrategies, _option) => {

                    const totalCostWithSign = totalCostCalculator({
                        buyOptions: [_option],
                        sellOptions: [option],
                        priceType
                    });

                    const margin = _option.optionDetails.strikePrice - option.optionDetails.strikePrice

                    const profit = totalCostWithSign

                    const profitPercent = profit / Math.abs(margin);
                    const strategyObj = {
                        option: {
                            ...option
                        },
                        positions:[option, _option],
                        strategyTypeTitle: "BECS",
                        expectedProfitNotif,
                        expectedProfitPerMonth,
                        name: createStrategyName([option, _option]),
                        profitPercent
                    }

                    if (Number.isNaN(strategyObj.profitPercent))
                        return _allPossibleStrategies

                    return _allPossibleStrategies.concat([strategyObj])

                }
                , []);

                return {
                    ...option,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BECS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceInPercent,
        maxStockPriceDistanceInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BECS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            minStockPriceDistanceInPercent,
            maxStockPriceDistanceInPercent,
            minVol
        })
    }

}




const calcBUS_With_BUCS_BEPSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName,  min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(buyingCall => {

                if (!buyingCall.isCallOption ||  buyingCall.vol < minVol)
                        return buyingCall


                const buyingCallPrice = getPriceOfAsset({
                        asset: buyingCall,
                        priceType,
                        sideType: 'BUY'
                });

                if(buyingCallPrice===0) return buyingCall
                

                const eligiblePutsForBEPS =   optionListOfSameDate.filter(_option => {
                    let isEligible = true;

                    if (_option.symbol === buyingCall.symbol || !_option.symbol.startsWith('ط') ||  _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= buyingCall.optionDetails?.strikePrice)
                        return false


                    if(!_option.optionDetails.stockSymbolDetails) return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent)  {
                        isEligible = true
                    }else{
                        isEligible = false;
                    }

                    return isEligible

                }
                );
              

                let allPossibleStrategies = eligiblePutsForBEPS.reduce( (_allPossibleStrategies, sellingPut) => {


                    const sellingPutPrice = getPriceOfAsset({
                        asset: sellingPut,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(sellingPutPrice===0) return _allPossibleStrategies


                    const higherStrikePuts = optionListOfSameDate.filter(_option => {

                        if (_option.symbol === sellingPut.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= sellingPut.optionDetails?.strikePrice)
                            return false

                        return true

                    }
                    );

                    let allPossibleStrategies =  higherStrikePuts.reduce((_allPossibleStrategies, buyingPut) => {


                        const buyingPutPrice = getPriceOfAsset({
                            asset: buyingPut,
                            priceType,
                            sideType: 'BUY'
                        });

                        if(buyingPutPrice===0) return _allPossibleStrategies

                        const sellingCallWithSameStrikeOfBuyingPut = optionListOfSameDate.find(_option=> _option.isCallOption && _option.vol > minVol && ( _option.optionDetails?.strikePrice === buyingPut.optionDetails?.strikePrice));


                        if(!sellingCallWithSameStrikeOfBuyingPut) return _allPossibleStrategies


                        const sellingCallWithSameStrikeOfBuyingPutPrice = getPriceOfAsset({
                            asset: sellingCallWithSameStrikeOfBuyingPut,
                            priceType,
                            sideType: 'SELL'
                        });

                        if(sellingCallWithSameStrikeOfBuyingPutPrice===0) return _allPossibleStrategies


                     
                        const totalCostWithSign = totalCostCalculator({
                            buyOptions: [buyingCall,buyingPut],
                            sellOptions: [sellingCallWithSameStrikeOfBuyingPut,sellingPut],
                            priceType
                        });

                        const totalOffsetGainWithSign = totalSettlementGain([{
                            option:buyingCall,
                            positionSide: "BUY"
                        }, {
                            option: buyingPut,
                            positionSide: "BUY",
                        }, ]);

                        const profit = totalCostWithSign + totalOffsetGainWithSign;

                        const profitPercent = profit / Math.abs(totalCostWithSign);
                        const strategyObj = {
                            option: {
                                ...buyingCall
                            },
                            positions:[buyingCall,sellingCallWithSameStrikeOfBuyingPut,buyingPut,sellingPut],
                            strategyTypeTitle: "BUS_With_BUCS_BEPS",
                            expectedProfitNotif,
                            expectedProfitPerMonth,
                            name: createStrategyName([buyingCall,sellingCallWithSameStrikeOfBuyingPut,buyingPut,sellingPut]),
                            profitPercent
                        }

                        if (Number.isNaN(strategyObj.profitPercent))
                            return _allPossibleStrategies

                        return _allPossibleStrategies.concat([strategyObj])


                    }, [])


                    

                    return _allPossibleStrategies.concat(allPossibleStrategies)

                }
                , []);

                return {
                    ...buyingCall,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUS_With_BUCS_BEPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUS_With_BUCS_BEPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }].filter(Boolean),
            minVol
        })
    }

}


const calcBUS_With_BUPS_BECSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName,  min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromHigherStrikeInPercent=-Infinity, maxStockPriceDistanceFromHigherStrikeInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(buyingPut => {

                if (!buyingPut.isPutOption ||  buyingPut.vol < minVol)
                        return buyingPut


                const buyingPutPrice = getPriceOfAsset({
                        asset: buyingPut,
                        priceType,
                        sideType: 'BUY'
                });

                if(buyingPutPrice===0) return buyingPut
                

                const eligibleCallsForBECS =   optionListOfSameDate.filter(_option => {
                    let isEligible = true;

                    if (_option.symbol === buyingPut.symbol || !_option.isCallOption ||  _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice <= buyingPut.optionDetails?.strikePrice)
                        return false


                    if(!_option.optionDetails.stockSymbolDetails) return false

                    const stockPriceHigherStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceHigherStrikeRatio > minStockPriceDistanceFromHigherStrikeInPercent && stockPriceHigherStrikeRatio < maxStockPriceDistanceFromHigherStrikeInPercent)  {
                        isEligible = true
                    }else{
                        isEligible = false;
                    }

                    return isEligible

                }
                );
              

                let allPossibleStrategies = eligibleCallsForBECS.reduce( (_allPossibleStrategies, sellingCall) => {


                    const sellingCallPrice = getPriceOfAsset({
                        asset: sellingCall,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(sellingCallPrice===0) return _allPossibleStrategies


                    const higherStrikeCalls = optionListOfSameDate.filter(_option => {

                        if (_option.symbol === sellingCall.symbol || !_option.isCallOption || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= sellingCall.optionDetails?.strikePrice)
                            return false

                        return true

                    }
                    );

                    let allPossibleStrategies =  higherStrikeCalls.reduce((_allPossibleStrategies, buyingCall) => {


                        const buyingCallPrice = getPriceOfAsset({
                            asset: buyingCall,
                            priceType,
                            sideType: 'BUY'
                        });

                        if(buyingCallPrice===0) return _allPossibleStrategies

                        const sellingPutWithSameStrikeOfBuyingCall = optionListOfSameDate.find(_option=> _option.isPutOption && _option.vol > minVol && ( _option.optionDetails?.strikePrice === buyingCall.optionDetails?.strikePrice));


                        if(!sellingPutWithSameStrikeOfBuyingCall) return _allPossibleStrategies


                        const sellingPutWithSameStrikeOfBuyingCallPrice = getPriceOfAsset({
                            asset: sellingPutWithSameStrikeOfBuyingCall,
                            priceType,
                            sideType: 'SELL'
                        });

                        if(sellingPutWithSameStrikeOfBuyingCallPrice===0) return _allPossibleStrategies


                     
                        const totalCostWithSign = totalCostCalculator({
                            buyOptions: [buyingCall,buyingPut],
                            sellOptions: [sellingPutWithSameStrikeOfBuyingCall,sellingCall],
                            priceType
                        });

                        const totalOffsetGainWithSign = totalSettlementGain([{
                            option:buyingCall,
                            positionSide: "BUY"
                        }, {
                            option: sellingCall,
                            positionSide: "SELL",
                        }, ]);

                        
                        

                        const BUPS_Margin = (sellingPutWithSameStrikeOfBuyingCall.optionDetails?.strikePrice - buyingPut.optionDetails?.strikePrice);
                        const BECS_Margin = (buyingCall.optionDetails?.strikePrice - sellingCall.optionDetails?.strikePrice);
                        const totalMargin = BUPS_Margin + BECS_Margin;

                        const profit =  totalCostWithSign + totalOffsetGainWithSign;

                        const profitPercent = profit  / Math.abs(totalMargin - totalCostWithSign);
                        const strategyObj = {
                            option: {
                                ...buyingCall
                            },
                            positions:[buyingPut,sellingPutWithSameStrikeOfBuyingCall,buyingCall,sellingCall],
                            strategyTypeTitle: "BUS_With_BUPS_BECS",
                            expectedProfitNotif,
                            expectedProfitPerMonth,
                            name: createStrategyName([buyingPut,sellingPutWithSameStrikeOfBuyingCall,buyingCall,sellingCall]),
                            profitPercent
                        }

                        if (Number.isNaN(strategyObj.profitPercent))
                            return _allPossibleStrategies

                        return _allPossibleStrategies.concat([strategyObj])


                    }, [])


                    

                    return _allPossibleStrategies.concat(allPossibleStrategies)

                }
                , []);

                return {
                    ...buyingPut,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BUS_With_BUPS_BECS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromHigherStrikeInPercent,
        maxStockPriceDistanceFromHigherStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BUS_With_BUPS_BECS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && minStockPriceDistanceFromHigherStrikeInPercent !== null && minStockPriceDistanceFromHigherStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromHigherStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromHigherStrikeInPercent !== null && maxStockPriceDistanceFromHigherStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromHigherStrikeInPercent) * 100).toFixed(0)}%`
            }].filter(Boolean),
            minVol
        })
    }

}


const calcBES_With_BUCS_BEPSStrategies = (list, {priceType, expectedProfitPerMonth, settlementGainChoosePriceType="MIN", strategySubName,  min_time_to_settlement=0, max_time_to_settlement=Infinity, minStockPriceDistanceFromLowerStrikeInPercent=-Infinity, maxStockPriceDistanceFromLowerStrikeInPercent=Infinity, minVol=CONSTS.DEFAULTS.MIN_VOL, expectedProfitNotif=false, ...restConfig}) => {

    const filteredList = list.filter(item => {
        if (!item.isOption)
            return
        const settlementTimeDiff = moment(item.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
        return settlementTimeDiff > min_time_to_settlement && settlementTimeDiff < max_time_to_settlement
    }
    )

    const optionsGroupedByStock = Object.groupBy(filteredList, ({optionDetails}) => optionDetails.stockSymbol);

    let enrichedList = [];
    for (let[stockSymbol,optionList] of Object.entries(optionsGroupedByStock)) {
        const optionsGroupedByDate = Object.groupBy(optionList, ({optionDetails}) => optionDetails.date);

        let enrichedListOfStock = Object.entries(optionsGroupedByDate).flatMap( ([date,optionListOfSameDate]) => {

            const _enrichedList = optionListOfSameDate.map(buyingCall => {

                if (!buyingCall.isCallOption ||  buyingCall.vol < minVol)
                        return buyingCall


                const buyingCallPrice = getPriceOfAsset({
                    asset: buyingCall,
                    priceType,
                    sideType: 'BUY'
                });

                if(buyingCallPrice===0) return buyingCall

                

                const eligiblePutsForBEPS =   optionListOfSameDate.filter(_option => {
                    let isEligible = true;

                    if (_option.symbol === buyingCall.symbol || !_option.symbol.startsWith('ط') ||  _option.vol < minVol)
                        return false
                    if (_option.optionDetails?.strikePrice >= buyingCall.optionDetails?.strikePrice)
                        return false

                    if(!_option.optionDetails.stockSymbolDetails) return false

                    const stockPriceLowerStrikeRatio = (_option.optionDetails.stockSymbolDetails.last / _option.optionDetails?.strikePrice) - 1;

                    if (stockPriceLowerStrikeRatio > minStockPriceDistanceFromLowerStrikeInPercent && stockPriceLowerStrikeRatio < maxStockPriceDistanceFromLowerStrikeInPercent)  {
                        isEligible = true
                    }else{
                        isEligible = false;
                    }

                    return isEligible

                }
                );
              

                let allPossibleStrategies = eligiblePutsForBEPS.reduce( (_allPossibleStrategies, sellingPut) => {


                    const sellingPutPrice = getPriceOfAsset({
                        asset: sellingPut,
                        priceType,
                        sideType: 'SELL'
                    });

                    if(sellingPutPrice===0) return _allPossibleStrategies


                    const higherStrikePuts = optionListOfSameDate.filter(_option => {

                        if (_option.symbol === sellingPut.symbol || !_option.symbol.startsWith('ط') || _option.vol < minVol)
                            return false
                        if (_option.optionDetails?.strikePrice <= sellingPut.optionDetails?.strikePrice || (_option.optionDetails?.strikePrice <= buyingCall.optionDetails?.strikePrice))
                            return false

                        return true

                    }
                    );

                    let allPossibleStrategies =  higherStrikePuts.reduce((_allPossibleStrategies, buyingPut) => {


                        const buyingPutPrice = getPriceOfAsset({
                            asset: buyingPut,
                            priceType,
                            sideType: 'BUY'
                        });

                        if(buyingPutPrice===0) return _allPossibleStrategies


                        const sellingCallWithSameStrikeOfBuyingPut = optionListOfSameDate.find(_option=> _option.isCallOption && _option.vol > minVol && ( _option.optionDetails?.strikePrice === buyingPut.optionDetails?.strikePrice));


                        if(!sellingCallWithSameStrikeOfBuyingPut) return _allPossibleStrategies


                        const sellingCallWithSameStrikeOfBuyingPutPrice = getPriceOfAsset({
                            asset: sellingCallWithSameStrikeOfBuyingPut,
                            priceType,
                            sideType: 'SELL'
                        });

                        if(sellingCallWithSameStrikeOfBuyingPutPrice===0) return _allPossibleStrategies

                        
                        const totalCostWithSign = totalCostCalculator({
                            buyOptions: [buyingCall,buyingPut],
                            sellOptions: [sellingCallWithSameStrikeOfBuyingPut,sellingPut],
                            priceType
                        });

                        const totalOffsetGainWithSign = totalSettlementGain([{
                            option:sellingPut,
                            positionSide: "SELL"
                        }, {
                            option: buyingPut,
                            positionSide: "BUY",
                        }, ]);

                        const profit = totalCostWithSign + totalOffsetGainWithSign;

                        const profitPercent = profit / Math.abs(totalCostWithSign);
                        const strategyObj = {
                            option: {
                                ...buyingCall
                            },
                            positions:[buyingCall,sellingCallWithSameStrikeOfBuyingPut,buyingPut,sellingPut],
                            strategyTypeTitle: "BES_With_BUCS_BEPS",
                            expectedProfitNotif,
                            expectedProfitPerMonth,
                            name: createStrategyName([buyingCall,sellingCallWithSameStrikeOfBuyingPut,buyingPut,sellingPut]),
                            profitPercent
                        }

                        if (Number.isNaN(strategyObj.profitPercent))
                            return _allPossibleStrategies

                        return _allPossibleStrategies.concat([strategyObj])


                    }, [])


                    

                    return _allPossibleStrategies.concat(allPossibleStrategies)

                }
                , []);

                return {
                    ...buyingCall,
                    allPossibleStrategies
                }

            }
            );

            return _enrichedList

        }
        )

        enrichedList = enrichedList.concat(enrichedListOfStock)

    }

    const sortedStrategies = getAllPossibleStrategiesSorted(enrichedList);

    return {
        enrichedList,
        allStrategiesSorted: sortedStrategies,
        strategyName: "BES_With_BUCS_BEPS",
        priceType,
        min_time_to_settlement,
        max_time_to_settlement,
        minStockPriceDistanceFromLowerStrikeInPercent,
        maxStockPriceDistanceFromLowerStrikeInPercent,
        minVol,
        expectedProfitNotif,
        expectedProfitPerMonth,
        ...restConfig,
        htmlTitle: configsToHtmlTitle({
            strategyName: "BES_With_BUCS_BEPS",
            strategySubName,
            priceType,
            min_time_to_settlement,
            max_time_to_settlement,
            customLabels: [typeof minStockPriceDistanceFromLowerStrikeInPercent !== 'undefined' && minStockPriceDistanceFromLowerStrikeInPercent !== null && minStockPriceDistanceFromLowerStrikeInPercent !== -Infinity && {
                label: "minToHigh",
                value: `${((minStockPriceDistanceFromLowerStrikeInPercent) * 100).toFixed(0)}%`
            }, typeof maxStockPriceDistanceFromLowerStrikeInPercent !== 'undefined' && maxStockPriceDistanceFromLowerStrikeInPercent !== null && maxStockPriceDistanceFromLowerStrikeInPercent !== Infinity && {
                label: "maxToHigh",
                value: `${((maxStockPriceDistanceFromLowerStrikeInPercent) * 100).toFixed(0)}%`
            }].filter(Boolean),
            minVol
        })
    }

}

const createListFilterContetnByList=(list)=>{

       let htmlContent = '';

    const strategyMapList = [
    calcLongGUTS_STRANGLEStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,

        // min_time_to_settlement: 15 * 24 * 3600000,
        // max_time_to_settlement: 40 * 24 * 3600000,
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
        expectedProfitNotif: true
    }), calcShortGUTSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        callListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol || option.optionDetails?.strikePrice >= option.optionDetails.stockSymbolDetails.last)
                return true
            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            if (stockStrikeDistanceInPercent > .12)
                return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        // min_time_to_settlement: 15 * 24 * 3600000,
        // max_time_to_settlement: 40 * 24 * 3600000,
        // minVol: 1000 * 1000 * 1000,
        maxStockPriceDistanceFromOption2StrikeInPercent: -.15,
        // expectedProfitNotif: true
    }), calcShortSTRANGLEStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        callListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol || option.optionDetails?.strikePrice <= option.optionDetails.stockSymbolDetails.last)
                return true
            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            if (stockStrikeDistanceInPercent > -.15)
                return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        // min_time_to_settlement: 15 * 24 * 3600000,
        // max_time_to_settlement: 40 * 24 * 3600000,
        // minVol: 1000 * 1000 * 1000,
        minStockPriceDistanceFromPutStrikeInPercent: .15,
        // expectedProfitNotif: true
    })
    
    , calcCALL_BUTTERFLYStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.isCallOption || option.vol < minVol)
                return true

            // const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.04) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })


    , calcCALL_CONDORStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.isCallOption || option.vol < minVol)
                return true

            // const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.04) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })


    , calcCALL_BUTT_CONDORStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        // minStockMiddleDistanceInPercent:-0.06,
        // maxStockMiddleDistanceInPercent:0.06,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .99,
        expectedProfitNotif: true // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })

    , calcPUT_BUTTERFLYStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.04) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })
    , calcPUT_CONDORStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.04) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })

    , calcPUT_BUTT_CONDORStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        // minStockMiddleDistanceInPercent:-0.06,
        // maxStockMiddleDistanceInPercent:0.06,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ط') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .99,
        expectedProfitNotif: true // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })
    

    , calcIRON_BUTTERFLY_BUCS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        // TODO: ignorer of option1
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            // const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })

    , calcIRON_CONDOR_BUCS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        // TODO: ignorer of option1
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            // const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })
    
   , calcIRON_BUTT_CONDOR_BUCS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        // minStockMiddleDistanceInPercent:-0.06,
        // maxStockMiddleDistanceInPercent:0.06,
        // TODO: ignorer of option1
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        minProfitLossRatio: .99,
        expectedProfitNotif: true // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })

    , calcIRON_BUTTERFLY_BUPS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })

    , calcIRON_CONDOR_BUPS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        minStockMiddleDistanceInPercent: -0.1,
        maxStockMiddleDistanceInPercent: 0.1,
        minProfitLossRatio: .7,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })
    , calcIRON_BUTT_CONDOR_BUPS_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 1 * 24 * 3600000,
        max_time_to_settlement: 63 * 24 * 3600000,
        // MIN_BUCS_BECS_diffStrikesRatio:1,
        // MAX_BUCS_BECS_diffStrikesRatio:1,
        // maxStockStrike4DistanceInPercent:-0.05,
        // minStockMiddleDistanceInPercent:-0.06,
        // maxStockMiddleDistanceInPercent:0.06,
        minProfitLossRatio: .99,
        expectedProfitNotif: true // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    })
    
    
    , calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.LAST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minVol: 1000 * 1000 * 1000,
        minStockPriceDistanceFromHigherStrikeInPercent: .22,
    }), calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
        minStockPriceDistanceFromHigherStrikeInPercent: .15,
        expectedProfitNotif: true
    }), calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
        //maxStockPriceDistanceFromHigherStrikeInPercent: .15,
        minStockPriceDistanceFromSarBeSarInPercent: 0.2,
        // maxStockPriceDistanceFromSarBeSarInPercent : 0.1
        // expectedProfitNotif: true
    }), calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        max_time_to_settlement: 15 * 24 * 3600000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .15,
        minStockPriceDistanceFromSarBeSarInPercent: 0.12,
        expectedProfitNotif: true
    }), 
    calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        max_time_to_settlement: 6 * 24 * 3600000,
        minStockPriceDistanceFromSarBeSarInPercent: .05,
        expectedProfitNotif: true
    }),

    calcBUS_With_BUCS_BEPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        minStockPriceDistanceFromHigherStrikeInPercent: .01,
    }),

    calcBUS_With_BUCS_BEPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        minStockPriceDistanceFromHigherStrikeInPercent: .12,
        // expectedProfitNotif: true,
    }),


    calcBUS_With_BUPS_BECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        minStockPriceDistanceFromHigherStrikeInPercent: .01,
    }),

    calcBUS_With_BUPS_BECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        minStockPriceDistanceFromHigherStrikeInPercent: .12,
        // expectedProfitNotif: true,
    }),



    

     calcBES_With_BUCS_BEPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        maxStockPriceDistanceFromLowerStrikeInPercent: -.01,
    }),
    calcBES_With_BUCS_BEPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 3 * 24 * 3600000,
        maxStockPriceDistanceFromLowerStrikeInPercent: -.12,
        expectedProfitNotif: true,
    }),

    
    
    




    , calcBUPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.LAST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minVol: 1000 * 1000 * 1000,
        minStockPriceDistanceInPercent: .22,
    }), calcBUPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minStockPriceDistanceInPercent: .22,
        minStockPriceDistanceInPercent: .15,
        expectedProfitNotif: true
    }), calcBUPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 40 * 24 * 3600000,
        // minStockPriceDistanceInPercent: .22,
        //maxStockPriceDistanceFromHigherStrikeInPercent: .15,
        minStockPriceDistanceInPercent: 0.2,
        // maxStockPriceDistanceFromSarBeSarInPercent : 0.1
        // expectedProfitNotif: true
    }), calcBUPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        max_time_to_settlement: 15 * 24 * 3600000,
        // minStockPriceDistanceInPercent: .15,
        minStockPriceDistanceInPercent: 0.12,
        expectedProfitNotif: true
    }), 
    calcBUPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        max_time_to_settlement: 6 * 24 * 3600000,
        minStockPriceDistanceInPercent: .05,
        expectedProfitNotif: true
    })
    
    , calcBUPS_COLLARStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        expectedProfitNotif: true // priceType: CONSTS.PRICE_TYPE.LAST_PRICE ,
    }),
    
    
    , calcBUCS_COLLAR_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        expectedProfitNotif: true // priceType: CONSTS.PRICE_TYPE.LAST_PRICE ,
    })
    , calcBEPS_COLLAR_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        expectedProfitNotif: true // priceType: CONSTS.PRICE_TYPE.LAST_PRICE ,
    })
    
    
    , calcBUCSRatioStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        maxBUCSCostSellOptionRatio: 1.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true
            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            if (stockStrikeDistanceInPercent < -.09)
                return true
            return false
        }
        ,
        // minStockPriceDistanceInPercent: -.2,
        maxStockPriceDistanceInPercent: .2,
        min_time_to_settlement: 39 * 24 * 3600000,
        max_time_to_settlement: 60 * 24 * 3600000,
    }), calcBUCSRatioStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        maxBUCSCostSellOptionRatio: 1.1,
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true
            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            if (stockStrikeDistanceInPercent < -.09)
                return true
            return false
        }
        ,
        // minStockPriceDistanceInPercent: -.2,
        maxStockPriceDistanceInPercent: .2,
        // min_time_to_settlement: 15 * 24 * 3600000,
        max_time_to_settlement: 39 * 24 * 3600000,
    }), // calcBOXStrategies(list, {
    //     priceType: CONSTS.PRICE_TYPE.LAST_PRICE,
    //     min_time_to_settlement: 6 * 24 * 3600000,
    //     // minVol: 1000 * 1000 * 1000,
    // }), 
    calcBOXStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 2 * 24 * 3600000,
        expectedProfitPerMonth: 1.02,
        expectedProfitNotif: true,
    }), 
    
    calcBOXStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 0,
        max_time_to_settlement: 2 * 24 * 3600000,
        expectedProfitPerMonth: 1.05,
        expectedProfitNotif: true,
    }),
    
    
    calcBOX_BUPS_BECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 2 * 24 * 3600000,
        expectedProfitPerMonth: 1.02,
        expectedProfitNotif: true,
    }), 
    calcBOX_BUPS_BECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 0,
        max_time_to_settlement: 2 * 24 * 3600000,
        expectedProfitPerMonth: 1.05,
        expectedProfitNotif: true,
    }), calcBECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 38 * 24 * 3600000,
        max_time_to_settlement: 55 * 24 * 3600000,
        maxStockPriceDistanceInPercent: -.22
    }), calcBECSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 2 * 24 * 3600000,
        max_time_to_settlement: 38 * 24 * 3600000,
        maxStockPriceDistanceInPercent: -.15,
        expectedProfitNotif: true
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        // expectedProfitNotif: true,
        minStockPriceDistanceInPercent: .08,
        min_time_to_settlement: 38 * 24 * 3600000,
        expectedProfitPerMonth: 1.04,
        expectedProfitNotif: true
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.LAST_PRICE,
        // expectedProfitNotif: true,
        minStockPriceDistanceInPercent: .08,
        min_time_to_settlement: 0,
        max_time_to_settlement: 38 * 24 * 3600000,
        expectedProfitPerMonth: 1.04,
        // expectedProfitNotif: true
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        // expectedProfitNotif: true,
        minStockPriceDistanceInPercent: .08,
        min_time_to_settlement: 0,
        max_time_to_settlement: 38 * 24 * 3600000,
        expectedProfitPerMonth: 1.04,
        expectedProfitNotif: true
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        minStockPriceDistanceInPercent: 0,
        maxStockPriceDistanceInPercent: .08,
        min_time_to_settlement: 38 * 24 * 3600000
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        minStockPriceDistanceInPercent: 0,
        maxStockPriceDistanceInPercent: .08,
        min_time_to_settlement: 0,
        max_time_to_settlement: 38 * 24 * 3600000
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        maxStockPriceDistanceInPercent: .001,
        min_time_to_settlement: 38 * 24 * 3600000
    }), calcCOVEREDStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        maxStockPriceDistanceInPercent: .001,
        min_time_to_settlement: 0,
        max_time_to_settlement: 38 * 24 * 3600000,
    })
    , calcCOVERED_COLLAR_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        expectedProfitPerMonth: 1.015,
        expectedProfitNotif: true
    })
    , calcCOVERED_CONVERSION_Strategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
    }), calcBEPSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        min_time_to_settlement: 2 * 24 * 3600000,
        maxStockPriceDistanceInPercent: -.12,
        expectedProfitNotif: true
    }), calcBUCSStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        strategySubName: "MAX",
        settlementGainChoosePriceType: "OPTION",
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true
            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            if (stockStrikeDistanceInPercent < -.05)
                return true
            return false
        }
        ,
        min_time_to_settlement: 1 * 24 * 3600000,
        // max_time_to_settlement: 35 * 24 * 3600000,
        max_time_to_settlement: 55 * 24 * 3600000,
    }), calcREVERSE_IRON_BUTTERFLYStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        strategySubName: "RIGHT",
        min_time_to_settlement: 10 * 24 * 3600000,
        max_time_to_settlement: 60 * 24 * 3600000,
        // showLeftRightProfitType:"LEFT&RIGHT",
        showLeftRightProfitType: "RIGHT",
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    }), calcREVERSE_IRON_BUTTERFLYStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        strategySubName: "LEFT",
        min_time_to_settlement: 10 * 24 * 3600000,
        max_time_to_settlement: 60 * 24 * 3600000,
        // showLeftRightProfitType:"LEFT&RIGHT",
        showLeftRightProfitType: "LEFT",
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    }), calcREVERSE_IRON_BUTTERFLYStrategies(list, {
        priceType: CONSTS.PRICE_TYPE.BEST_PRICE,
        strategySubName: "LEFT&RIGHT",
        min_time_to_settlement: 10 * 24 * 3600000,
        max_time_to_settlement: 60 * 24 * 3600000,
        showLeftRightProfitType: "LEFT&RIGHT",
        // showLeftRightProfitType:"LEFT",
        BUCSSOptionListIgnorer: ({option, minVol}) => {
            if (!option.optionDetails?.stockSymbolDetails || !option.symbol.startsWith('ض') || option.vol < minVol)
                return true

            const stockStrikeDistanceInPercent = (option.optionDetails.stockSymbolDetails.last / option.optionDetails?.strikePrice) - 1;
            // if (stockStrikeDistanceInPercent < -.06) return true
            // if (stockStrikeDistanceInPercent > .15) return true
            return false
        }
        ,
        // expectedProfitNotif: true
        // minVol: 1000 * 1000 * 1000,
        // minStockPriceDistanceFromHigherStrikeInPercent: .22,
    }), ]

    let allStrategyListObject  = strategyMapList.map( ({allStrategiesSorted, htmlTitle, expectedProfitNotif}) => {
        let filteredStrategies = allStrategiesSorted.filter(strategy => {
            if (strategy.profitPercent < 0)
                return false
        

            if (strategy.profitPercent <  generalConfig.minProfitToFilter)
                return false
            
            const minDiffTimeOflastTrade = 6 * 60 * 1000;
            if ((Date.now() - strategy.option.lastTrackedChangeTime) > minDiffTimeOflastTrade) {
                return false
            }

            const settlementTimeDiff = moment(strategy.option.optionDetails.date, 'jYYYY/jMM/jDD').diff(Date.now());
            const daysToSettlement = Math.floor(settlementTimeDiff / (24 * 3600000));
            const percentPerDay = Math.pow((1 + strategy.profitPercent), 1 / daysToSettlement);
            const percentPerMonth = Math.pow(percentPerDay, 30);
   
            return percentPerMonth > ((strategy.expectedProfitPerMonth !== undefined && strategy.expectedProfitPerMonth !== null) ? strategy.expectedProfitPerMonth : generalConfig.expectedProfitPerMonth)
        }
        );

        const ignoreStrategyList = getIgnoreStrategyNames();
        const filterSymbolList = getFilterSymbols();

        filteredStrategies = filteredStrategies.filter(strategy => {
            if (filterSymbolList.length && !filterSymbolList.find(filteredSymbol => strategy.name.includes(filteredSymbol)))
                return
            const strategySymbols = strategy.positions.map(pos=>pos.symbol);
            if (ignoreStrategyList.find(ignoreStrategyObj => {

                if(!ignoreStrategyObj.name) return
                if (ignoreStrategyObj.type !== 'ALL' && ignoreStrategyObj.type !== strategy.strategyTypeTitle)
                    return false
                
               

                if(ignoreStrategyObj.name===strategy.name) return true
                if (strategySymbols.some(symbol=>symbol.includes(ignoreStrategyObj.name)))
                    return true
                
            }
            ))
                return
            return true
        }
        );

        filteredStrategies = filteredStrategies.sort( (strategyObjA, strategyObjB) => {
            if (strategyObjA.profitPercent < strategyObjB.profitPercent) {
                return 1;
            } else if (strategyObjA.profitPercent > strategyObjB.profitPercent) {
                return -1;
            }
            // a must be equal to b
            return 0;
        }
        )


        return {
            htmlContent: htmlStrategyListCreator({
                strategyList: filteredStrategies,
                title: htmlTitle,
                expectedProfitNotif
            }),
            filteredStrategies,
            expectedProfitNotif,
            htmlTitle
        }


    }
    )

    checkProfitsAnNotif({
            sortedStrategies: allStrategyListObject.flatMap(strategyObj=>strategyObj.filteredStrategies)
    });

    htmlContent +=  allStrategyListObject.map(strategyObj=>strategyObj.htmlContent).join('');

    setFiltersContent(htmlContent)

}

const createList = ()=>{
    const allElementList = Array.from(document.querySelectorAll('#main [class="{c}"]'));
    if(!allElementList?.length) return []

    let allStockSymbolDetailsMap = {};

    let list = allElementList.map(row => {

        const symbolID = row.getAttribute('id')
        const cells = document.querySelectorAll(`[id='${symbolID}'] >div`)

        const name = cells[1].querySelector('a').innerHTML;
        const quantityOfTrades = convertStringToInt(cells[2].innerHTML);
        const isOption = ['اختيارخ', 'اختيارف'].some(optionTypeName => name.includes(optionTypeName));

        const symbol = cells[0].querySelector('a').innerHTML.trim();

        const prevRecordObj = prevListSymbolMap[symbol];

        const lastTrackedChangeTime = ( () => {
            if (!prevRecordObj || !prevRecordObj.quantityOfTrades || (quantityOfTrades > prevRecordObj.quantityOfTrades)) {
                return Date.now();
            }
            return prevRecordObj.lastTrackedChangeTime

        }
        )();
        const isCallOption = isOption && symbol.startsWith('ض');
        const isPutOption = isOption && symbol.startsWith('ط');
        let optionDetails;
        if (isOption) {
            const date = name.split('-').pop();
            const strikePrice = convertStringToInt(name.split('-')[1]);
            const stockSymbol = name.split('-')[0].replace('اختيارخ', '').replace('اختيارف', '').trim();

            optionDetails = {
                date,
                stockSymbol,
                strikePrice
            }
        }

        prevListSymbolMap[symbol] = {
            quantityOfTrades,
            lastTrackedChangeTime
        }

        return {
            symbol,
            name,
            isOption,
            isCallOption,
            quantityOfTrades,
            lastTrackedChangeTime,
            isPutOption,
            optionDetails,
            vol: parseStringToNumber(cells[4].querySelector('div').innerHTML),
            last: convertStringToInt(cells[7].innerHTML),
            bestBuyQ: convertStringToInt(cells[18].querySelector('div').innerHTML),
            bestBuy: convertStringToInt(cells[19].innerHTML),
            bestSell: convertStringToInt(cells[20].innerHTML),
            bestSellQ: convertStringToInt(cells[21].querySelector('div').innerHTML)
        }
    }
    );

    list = list.map(listItem => {

        if (!listItem.isOption)
            return listItem
        allStockSymbolDetailsMap[listItem.optionDetails.stockSymbol] = allStockSymbolDetailsMap[listItem.optionDetails.stockSymbol] || list.find(_item => _item.symbol === listItem.optionDetails.stockSymbol);
        const stockSymbolDetails = allStockSymbolDetailsMap[listItem.optionDetails.stockSymbol]
        listItem.optionDetails.stockSymbolDetails = stockSymbolDetails
        return listItem
    }
    );

    return list

}


const ignoreStrategyTemporary = (strategyName)=>{

    tempIgnoredNotifList.push(strategyName);


    setTimeout( () => {
        tempIgnoredNotifList = tempIgnoredNotifList.filter(_strategyName => strategyName !== _strategyName)
    }
    , 160000);

}



const getMainContainer = () => {

    const createCnt = () => {

        let mainContainer = document.createElement('div');

        mainContainer.classList.add('amin-main-cnt');

        mainContainer.style.cssText += `
            background: rgb(255, 255, 255);
            position: absolute;
            height: 100vh;
            top: 0px;
            z-index: 50000;
            overflow: auto;
            direction: rtl;
            left: 0px;
            right: 0px;
            display: flex;
            font-size: 20px;
        `;

        let contentPanel = document.createElement('div');
        let filtersCnt = document.createElement('div');

        contentPanel.classList.add('amin-status-cnt');

        contentPanel.style.cssText += `
         background: rgb(255, 255, 255);
        height: 100vh;
        width:100%;
        top: 0px;
        z-index: 50000;
        overflow: auto;
        direction: rtl;
        left: 0px;
        right: 0px;
        padding-right: 0px;
        padding-left: 0px;
        display: flex;
        font-size: 20px;
        flex-wrap: wrap;
        align-content: flex-start;
    `;

        filtersCnt.classList.add('amin-status-cnt__filters-cnt');

        filtersCnt.style.cssText += `
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        width:100%;
        min-height: 300vh;
    `;

        filtersCnt.addEventListener('click', (event) => {

            if (event.target.classList.contains('strategy-name')) {

                const strategyName = event.target.innerHTML;
                const strategyType = event.target.getAttribute("data-base-strategy-type");

                navigator?.clipboard?.writeText(`${strategyType}@${strategyName}`)

                ignoreStrategyTemporary(strategyName);
                
            }
        }
        )

        contentPanel.appendChild(filtersCnt);

        mainContainer.append(contentPanel);

        let silentButton = document.createElement('button');


        silentButton.style.cssText += `
                position: absolute;
                left: 7px;
                width: auto;
                cursor: pointer;
                z-index: 500000;
                height: auto;
                padding: 7px;
                font-size: large;
                font-weight: bold;
        `;

        silentButton.appendChild(document.createTextNode("سکوت موقت"))

 
        let silentButtonTimeoutID;
        silentButton.addEventListener('click', (event) => {
            clearTimeout(silentButtonTimeoutID);

            isSilentModeActive = true;

            silentButtonTimeoutID = setTimeout( () => {
                isSilentModeActive = false;
            }
            , 160000);

           
        });


        mainContainer.append(silentButton);

        return mainContainer

    }

    const mainCnt = document.querySelector('.amin-main-cnt') || createCnt();
    if (!document.querySelector('.amin-main-cnt')) {
        document.body.append(mainCnt);
    }

    return mainCnt

}

const setFiltersContent = (htmlContent) => {

    const mainContent = getMainContainer();

    const filtersCnt = mainContent.querySelector('.amin-status-cnt__filters-cnt');
    filtersCnt.innerHTML = htmlContent;
}

const getGeneralIgnoreText = ()=> document.querySelector('.amin-filter-cnt textarea.amin-ignoreList.amin-ignoreList--general').value
const setGeneralIgnoreText = (value)=> document.querySelector('.amin-filter-cnt textarea.amin-ignoreList.amin-ignoreList--general').value = value;

const getIgnoreStrategyNames = () => {
    const privateIgnoreListText = document.querySelector('.amin-filter-cnt textarea.amin-ignoreList.amin-ignoreList--private').value;
    const generalIgnoreListText = getGeneralIgnoreText();
    const ignoreListText = `${privateIgnoreListText} ${generalIgnoreListText} `
    if (!ignoreListText)
        return []

    const ignoreListTextWithoutSpaces = ignoreListText.replace(/\s+/g, '*');
    if (!ignoreListTextWithoutSpaces)
        return []
    let ignoreStrategyNames = ignoreListTextWithoutSpaces.split('*');
    if (!ignoreStrategyNames?.length)
        return []
    ignoreStrategyNames = ignoreStrategyNames.filter(Boolean);
    return ignoreStrategyNames.map(ignoreStrategyName => {
        const strategyTypeAndName = ignoreStrategyName.split('@');
        if (!strategyTypeAndName?.length)
            return {
                type: null,
                name: null
            }
        return {
            type: strategyTypeAndName[0],
            name: strategyTypeAndName[1]
        }
    }
    );
}

const getFilterSymbols = () => {
    const ignoreListText = document.querySelector('.amin-filter-cnt textarea.amin-filterList').value;
    const ignoreListTextWithoutSpaces = ignoreListText.replace(/\s+/g, '*');
    let ignoreStrategyNames = ignoreListTextWithoutSpaces.split('*');
    return ignoreStrategyNames.filter(Boolean);

}

const createFilterPanel = () => {

    let mainCnt = getMainContainer();

    let cnt = document.createElement('div');

    cnt.classList.add('amin-filter-cnt');

    cnt.style.cssText += `
        width: 200px;
        height: 100vh;
        display: flex;
        flex-direction: column;
    `;

    cnt.innerHTML = `
        <textarea class="amin-ignoreList amin-ignoreList--private"  style="width: 176px; min-width: 122px; height: 299px; font-size: 12px;"></textarea>
        <textarea class="amin-ignoreList amin-ignoreList--general"  style="width: 176px; min-width: 122px; height: 299px; font-size: 12px;"></textarea>
        <textarea class="amin-filterList"  style="width: 170px; min-width: 122px; height: 53px; font-size: 12px;"></textarea>`;

        
    mainCnt.prepend(cnt);

}

const interval = () => {
    const list = createList();
    if(list?.length>0){
        createListFilterContetnByList(list);
        
        newTabList.forEach(childWindowTab=>{
            const  generalIgnoreText = getGeneralIgnoreText();
            if(childWindowTab.document.readyState === "complete"){
                //notifiedStrategyList=[]
                childWindowTab.postMessage({ 
                    list ,
                    generalIgnoreText ,
                    $tempIgnoredNotifList: tempIgnoredNotifList,
                    $notifiedStrategyList :notifiedStrategyList
                }, "*");
            }
        });
    }

    setTimeout(interval, 2000)
}

let newTabList =[];

const openNewTab = ()=>{

    const newWin = window.open("option-filter-child.html", "_blank");

    newTabList.push(newWin);

}

const injectStyles = ()=>{

    const css = `
    
        body {
            font-family: Tahoma;
        }

        @supports not selector(::-webkit-scrollbar) {
            *{
                scrollbar-width: thin;
                scrollbar-color: #939191;

            }
        }
        @supports selector(::-webkit-scrollbar) {

            ::-webkit-scrollbar-thumb {
                background-color:#939191
            }
            
            ::-webkit-scrollbar {
                width: 0.25rem;
                height: 0.25rem;
            }

            .kateb-scroll-gray::-webkit-scrollbar-thumb{
                background-color:#939191
            }
        }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
}




const RUN = () => {
    // var momentJalaliScriptTag = document.createElement('script');
    // momentJalaliScriptTag.src = "https://cdn.jsdelivr.net/npm/jalali-moment@3.2.3/dist/jalali-moment.browser.js";
    // document.head.appendChild(momentJalaliScriptTag);

    // momentJalaliScriptTag.onload = function () {

    // console.log(moment('1403/11/3', 'jYYYY/jM/jD HH:mm').format('YYYY-M-D HH:mm:ss'))
    createFilterPanel();

    // alert('حجم')
    interval()
    // } ;

    if (!moment) alert('moment  error');


    injectStyles();

    window.addEventListener("message", (event) => {
        const { list ,generalIgnoreText='' ,$tempIgnoredNotifList=[],$notifiedStrategyList=[] } = event.data;
        if(!list?.length) return 


        const notifiedStrategyNameList = $notifiedStrategyList.map(s=>s.name);
        

        $tempIgnoredNotifList.concat(notifiedStrategyNameList).forEach(_strategyName=> !tempIgnoredNotifList.includes(_strategyName) &&  ignoreStrategyTemporary(_strategyName))


        setGeneralIgnoreText(generalIgnoreText)



        createListFilterContetnByList(list);
    });

}

RUN();






