const slug = "pen-writing-on-paper-vXw8FdlS7J";
const urls = [
  `https://lottie.host/embed/${slug}.json`,
  `https://lottie.host/${slug}.json`,
  `https://embed.lottiefiles.com/${slug}`,
  `https://assets-v2.lottiefiles.com/a/${slug}/full.json`,
];

for (const url of urls) {
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") ?? "";
  const head = (await res.text()).slice(0, 80);
  console.log(res.status, ct.slice(0, 40), url);
  console.log(" ", head.replace(/\s+/g, " "));
}
