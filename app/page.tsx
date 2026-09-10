import Link from "next/link";
import "./kflix-home.css";

const stories = [
  { category: "FILM", title: "The New Language of Cinema", time: "12 min ago", crop: "portal" },
  { category: "MUSIC", title: "Sound in Color", time: "24 min ago", crop: "headphones" },
  { category: "CULTURE", title: "Night to Remember", time: "38 min ago", crop: "gallery" },
  { category: "NEWS", title: "Beyond the Horizon", time: "1 hour ago", crop: "satellite" },
];

const trendingStories = [
  { category: "FILM", title: "Era of Echoes", subtitle: "Trailer breakdown", crop: "portal" },
  { category: "MUSIC", title: "Neon Reverie", subtitle: "Album of the week", crop: "headphones" },
  { category: "FILM", title: "Dunechild", subtitle: "Inside the epic world", crop: "satellite" },
  { category: "CULTURE", title: "Red Carpet Replay", subtitle: "Best looks & moments", crop: "gallery" },
  { category: "MUSIC", title: "Voices Unfiltered", subtitle: "The interview series", crop: "headphones" },
];

export default function Home() {
  return <main className="kflix-page">
    <header className="kflix-nav"><Link href="/" className="kflix-logo">KFLIX<span>MEDIA</span></Link><nav aria-label="Main navigation"><a href="#film">Film</a><a href="#music">Music</a><a href="#culture">Culture</a><a href="#news">News</a></nav><button className="menu-button" aria-label="Open menu"><i /><i /></button></header>
    <section className="hero" aria-labelledby="hero-heading"><div className="hero-copy"><h1 id="hero-heading">Culture<br />in motion<span>.</span></h1><p>Entertainment news for what comes next.</p><a href="#latest" className="scroll-link">Scroll to explore <b>↓</b></a></div><div className="feature-stack" aria-label="Featured stories"><Feature crop="portal" category="FILM" title="Beyond the Horizon" copy="A new vision of tomorrow." /><Feature crop="headphones" category="MUSIC" title="Sound in Color" copy="The artist shaping the moment." /><Feature crop="gallery" category="CULTURE" title="Night to Remember" copy="Where style and story collide." /></div></section>
    <section className="trending" aria-label="Trending stories"><strong>Trending <b>↗</b></strong><span className="trending-divider" />{trendingStories.map((s) => <a href="#latest" key={s.title}><span className={`mini-still ${s.crop}`} /><span><em>{s.category}</em><span className="trending-title">{s.title}</span><small>{s.subtitle}</small></span></a>)}<button className="trending-next" aria-label="More trending stories">→</button></section>
    <section className="latest" id="latest" aria-labelledby="latest-heading"><Title id="latest-heading">Latest stories</Title><div className="latest-grid"><div className="story-list">{stories.map((s) => <article className="story-row" key={s.title}><div className={`story-image ${s.crop}`} /><div><em>{s.category}</em><h3>{s.title}</h3><small>{s.time}</small></div><b aria-hidden="true">↗</b></article>)}</div><aside className="manifesto"><div><p>KFLIXMEDIA</p><h2>Stories<br />without<br />limits</h2><a href="#now-playing">Explore the edit ↗</a></div></aside></div></section>
    <section className="now-playing" id="now-playing" aria-labelledby="playing-heading"><Title id="playing-heading">Now playing</Title><div className="poster-grid">{["Echoes of Dawn", "Neon Reverie", "Children of the Dust", "Velvet Nights"].map((title, index) => <article className={`poster poster-${index}`} key={title}><h3>{title}</h3><small>{index === 1 ? "Music" : index === 3 ? "Culture" : "Film"}</small></article>)}</div></section>
    <section className="newsletter"><h2>Stay ahead of the story</h2><p>Fresh updates on film, music, culture, and news—delivered to you.</p><form><label className="sr-only" htmlFor="email">Email address</label><input id="email" type="email" placeholder="Enter your email" /><button type="submit">Subscribe</button></form></section>
    <footer className="kflix-footer"><div className="kflix-logo">KFLIX<span>MEDIA</span></div><FooterGroup title="Navigation" links={["Film", "Music", "Culture", "News"]} /><FooterGroup title="Discover" links={["Trending", "Latest stories", "Now playing"]} /><FooterGroup title="Follow" links={["Instagram", "X", "YouTube"]} /><small>© 2026 KFLIXMEDIA</small></footer>
  </main>;
}

function Feature({ crop, category, title, copy }: { crop: string; category: string; title: string; copy: string }) { return <article className={`feature-card feature-${crop}`}><small>— {category}</small><div><h2>{title}</h2><p>{copy}</p></div></article>; }
function Title({ id, children }: { id: string; children: React.ReactNode }) { return <div className="section-title"><span /> <h2 id={id}>{children}</h2></div>; }
function FooterGroup({ title, links }: { title: string; links: string[] }) { return <div><strong>{title}</strong>{links.map((link) => <a href="#" key={link}>{link}</a>)}</div>; }
