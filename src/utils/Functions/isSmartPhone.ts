export function checkSmartPhone() {
    const ua = navigator.userAgent
    const isIOS =
        !!ua.match(/iPhone|iPad/) ||
        (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
    const isAndroid = !!ua.match(/Android/)
    return isIOS || isAndroid
}

export const isSmartPhone = checkSmartPhone()
