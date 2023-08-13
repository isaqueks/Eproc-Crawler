
export default function getCookieHeader(cookies: Map<string, string>): string {
    const cookiesArray = [];
    for (const [key, value] of cookies) {
        cookiesArray.push(`${key}=${value}`);
    }
    return cookiesArray.join('; ');
}