const Binance = require('binance-api-node').default
const threeCommasAPI = require('3commas-api-node')

const { apiKey, apiSecret, apiKey3Commas, apiKeySecret3Comams } = require('./constants.js')

const client = Binance({
    apiKey: apiKey,
    apiSecret: apiSecret
})
const commas = new threeCommasAPI({
    apiKey: apiKey3Commas,
    apiSecret: apiKeySecret3Comams,
})



const args = process.argv.slice(2);
const argSymbol = (typeof args[0] == 'undefined') ? '' : args[0].replace('symbol=', '') //забираем аргумент из консоли вида symbol=BTCUSDT
const lenDonchian = 10 //длина канала дончана на которую смотрим
const symbol = (argSymbol == '') ? 'BTCUSDT' : argSymbol //текущая валюта
let equity = 1000 //текущие средства
const sizelong = 3 //процент средств который мы кладем в одну сделку
const interval = '4h' //интервал для баров
const takeprofit = 3 //это процент тейк профита, который мы хотим


function formatTime(time) {
    return new Date(time).toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '')
}


function chanelDonchian(data, takeprofit, equity, sizelong) {
    const lengthData = data.length - 1
    const tp = takeprofit

    let arrayHighPrice = []
    let arrayLowPrice = []

    data.map(tick => {
        arrayHighPrice.push(parseFloat(tick.high))
        arrayLowPrice.push(parseFloat(tick.low))
    })


    const h = Math.max(...arrayHighPrice.slice(arrayHighPrice.length - lenDonchian, arrayHighPrice.length)) //находим макс значение
    const l = Math.min(...arrayLowPrice.slice(arrayLowPrice.length - lenDonchian, arrayLowPrice.length)) //находим мин значение
    const center = (h + l) / 2 //находим центральное значение

    const tpl = h * (100 + tp) / 100 //считаем где будет наш тейк профит
    const tps = l * (100 - tp) / 100 //считаем где будет наш стоп луз


    const lotlong = equity / data[lengthData].close * sizelong / 100 //то кол-во валюты которое мы закупим
    const mo = (data[lengthData].high >= center && data[lengthData].low <= center) //это условие входа в сделку
    const openTime = formatTime(data[lengthData].openTime)
    const closeTime = formatTime(data[lengthData].closeTime)

    return {
        h, l, center, tpl, tps, lotlong, mo, sizelong, equity, tp, openTime, closeTime
    }
}

function prediction(symbol, equity, sizelong, interval, takeprofit) {
    return client
        .candles({
            symbol: symbol,
            interval: interval,
            limit: 160
        })
        .then(response => {
            const data = response
            let position = {
                open: false,
                config: {
                    /*
                        longlimit
                        longstop
                        lotlong
                        h
                    */
                }
            } //open - есть ли сейчас открытая позиция, config - это собственно настройки этой позиции

            const donchian = chanelDonchian(data, takeprofit, equity, sizelong)
            const closeTime = new Date(data[data.length - 1].closeTime) //время закрытия последнего бара
            console.log(closeTime)
            
            if (donchian.mo) { //если выполняется условие на покупку
                const longlimit = donchian.tpl 
                const longstop = donchian.center 

                equity = equity - donchian.lotlong * donchian.h

                position.config = {
                    longlimit: longlimit,
                    longstop: longstop,
                    lotlong: donchian.lotlong
                }

                console.log(`BUY SYMBOL ${symbol}, 
                    выставляем стоп-ордер на ${donchian.h} (лучше выставить стоп на -0.1, а уже лимитный поставить на эту цену),
                    берем тейк-профит ${longlimit},
                    стоп луз ставим на ${longstop}
                `)

            } else {
                console.log('nothing')
            }
        })
}


prediction(symbol, equity, sizelong, interval, takeprofit)

/*
- нужно ли нам иметь больше одного активного смартрейда в определнной паре?
- смотрим на кол-во созданных смартрейдов в паре, если их больше то не создаем
- если нашли и видим что цены примерно одинаковые то ничего не делаем, если цены разнятся больше чем на 1 то создаем смартрейд (кондишен)
- нету своей системы выставления ордеров
*/

/*commas
.smartTradesV2({
    status : 'active'
})
.then(data => console.log(data))
*/

