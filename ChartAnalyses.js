export function calculateSMA(data, period) {
  //console.log('madata in', data);
  
    let smaData = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        smaData.push(null);  // Not enough data points for SMA
      } else {
        const sum = data.slice(i - period + 1, i + 1)
                        .map(point => point.y)
                        .filter(yValue => yValue !== null && yValue !== undefined)  // Filter out null/undefined values
                        .reduce((acc, val) => acc + val, 0);
        smaData.push(sum / period);
      }
    }
    return smaData;
  }
  


export function calculateRSI(data, period = 14) {
    let rsiData = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            rsiData.push(null); // Not enough data points for RSI
        } else {
            let gains = 0, losses = 0;
            for (let j = i - period + 1; j <= i; j++) {
                const change = data[j].y - data[j - 1].y;
                if (change > 0) gains += change;
                else losses += Math.abs(change);
            }
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            rsiData.push(rsi);
        }
    }
    return rsiData;
}

