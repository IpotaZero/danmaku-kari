// crypto.randomUUID()はsecure context(HTTPS/localhost)でしか使えず、
// スマホ実機をLAN経由のhttpでテストすると存在しないため使わない
export function uid(): string {
    return Math.random().toString(36).slice(2)
}
