export function getCryptoAddress(crypto = "bitcoin") {
    const addresses = {
        "bitcoin": "bc1qtf6yc0c0dj5un7qv0rd2kwv9pndllslc588jgs",
        "bnb bep20": "0x2d88c2cE954cbe5CBc2FB9209eeD6de28cC905d6",
        "usdt trc20": "TMpfxKA3eBjsWQpZwRHYVPrRwdnytjng7Y",
        "usdt erc20": "0x2d88c2cE954cbe5CBc2FB9209eeD6de28cC905d6",
        "solana": "77FRRDBUdGqSUiNCb5NSmmT9JrckTfB5GLpqm5uNorDR"
    };
    
    return addresses[crypto.toLowerCase()] || addresses["bitcoin"];
}

export function getWithdrawalWallet(wallet) {
    const shortForm = {
        "bitcoin": "btc",
        "bnb bep20": "bep20",
        "usdt trc20": "trc20",
        "usdt erc20": "erc20",
        "solana": "sol"
    };

    return shortForm[wallet.toLowerCase()] || "no valid wallet";
}