const slug = process.argv[2] ?? "pen-writing-on-paper-vXw8FdlS7J";
const url = `https://lottiefiles.com/free-animation/${slug}`;
const res = await fetch(url);
const html = await res.text();
const jsonUrls = [...new Set(html.match(/https:\/\/[^"'\\s]+\.json/g) ?? [])];
const hostUrls = [...new Set(html.match(/https:\/\/lottie\.host\/[^"'\\s]+/g) ?? [])];
console.log("json:", jsonUrls.slice(0, 8).join("\n") || "(none)");
console.log("host:", hostUrls.slice(0, 8).join("\n") || "(none)");
