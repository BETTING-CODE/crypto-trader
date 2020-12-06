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

const lenDonchian = 10 //длина канала дончана на которую смотрим
let equity = 1000 //текущие средства
const sizelong = 3 //процент средств который мы кладем в одну сделку
const interval = '4h' //интервал для баров
const takeprofit = 3 //это процент тейк профита, который мы хотим

function formatNumber(num) {
    return Math.round(num * 100) / 100
}

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
            let position = { }
            const donchian = chanelDonchian(data, takeprofit, equity, sizelong)
            const closeTime = new Date(data[data.length - 1].closeTime) //время закрытия последнего бара

            if (donchian.mo) { //если выполняется условие на покупку
                const longlimit = donchian.tpl
                const longstop = donchian.center

                equity = equity - donchian.lotlong * donchian.h

                position = {
                    closeTime: closeTime,
                    stopOrder: donchian.h,
                    longlimit: longlimit,
                    longstop: longstop,
                    lotlong: donchian.lotlong
                }

                return position

            } else {
                return null
            }
        })
}

commas
    .smartTradesV2({
        status: 'active'
    })
    .then(data => {
        let array = []
        for (let i = 0; i < data.length; i++) {
            const st = data[i]
            array.push({
                id: st.id,
                pair: st.pair,
                status: st.status.title,
                position: st.position.type,
                usd_profit: formatNumber(st.profit.usd),
                enter_price: Number(st.data.average_enter_price) //помните что эта цифра идет уже с комиссией
            })
        }

        console.table(array)

        const SYMBOLS = ['BTCUSDT', 'ETHUSDT']

        for (let i = 0; i < SYMBOLS.length; i++) {
            prediction(SYMBOLS[i], equity, sizelong, interval, takeprofit)
                .then(data => {
                    if (data == null) {
                        console.log(`К паре ${SYMBOLS[i]} мы не нашли подходящих входов`)
                    } else {
                        console.log(`Выставялем смарт-трейд ${SYMBOLS[i]}, 
                            выставляем стоп-ордер на ${data.stopOrder} (лучше выставить стоп на -0.1, а уже лимитный поставить на эту цену),
                            берем тейк-профит ${data.longlimit},
                            стоп луз ставим на ${data.longstop}
                        `)
                    }
                })
        }
    })

