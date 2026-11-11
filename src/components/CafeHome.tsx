import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Coffee,
  Home,
  MapPin,
  Users,
  Utensils,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TIME_SLOTS } from '../data/cafeData';
import heroImage from '../assets/cafe-hero.jpg';
import coffeeImage from '../assets/cafe-coffee.jpg';
import pastryImage from '../assets/cafe-pastries.jpg';
import brunchImage from '../assets/cafe-brunch.jpg';
import './home.css';

export interface BookingIntent {
  date: string;
  time: string;
  partySize: number;
}

interface CafeHomeProps {
  onBook: (intent: BookingIntent) => void;
}

interface FooterTiltLinkProps {
  href: string;
  label: string;
  Icon: LucideIcon;
}

function FooterTiltLink({ href, label, Icon }: FooterTiltLinkProps) {
  return (
    <a className="home-footer-link" href={href}>
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
      <ArrowRight size={13} aria-hidden="true" />
    </a>
  );
}

const menuCards = [
  {
    title: 'Coffee & Espresso',
    description: 'Expertly brewed classics, from smooth lattes to bold espresso.',
    price: 'From $5.50',
    image: coffeeImage,
    alt: 'A cappuccino with leaf latte art in a cream ceramic cup',
    detail: 'Brewed to order',
  },
  {
    title: 'Freshly Baked',
    description: 'House-made pastries and seasonal treats, baked daily.',
    price: 'From $7.00',
    image: pastryImage,
    alt: 'Fresh golden croissants on a ceramic cafe plate',
    detail: 'Made fresh daily',
  },
  {
    title: 'All-Day Brunch',
    description: 'Hearty, fresh, and flavorful favorites for any time of day.',
    price: 'From $9.00',
    image: brunchImage,
    alt: 'Avocado toast with a poached egg, herbs, and tomatoes',
    detail: 'Served all day',
  },
];

const galleryImages = [
  { image: coffeeImage, alt: 'Latte art at the Corner Cafe', label: 'A good start' },
  { image: pastryImage, alt: 'Freshly baked croissants', label: 'From the oven' },
  { image: heroImage, alt: 'Sunlit table beside the cafe window', label: 'Find your seat' },
  { image: brunchImage, alt: 'A fresh brunch plate', label: 'A little longer' },
];

function todayAsDateInput(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function CafeHome({ onBook }: CafeHomeProps) {
  const [date, setDate] = useState(todayAsDateInput);
  const [time, setTime] = useState('10:30 AM');
  const [partySize, setPartySize] = useState(2);

  const handleFindTable = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onBook({ date, time, partySize });
  };

  const bookToday = () => onBook({ date, time, partySize });

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header__inner">
          <a className="home-brand" href="#home" aria-label="The Corner Cafe home">THE CORNER CAFE</a>
          <nav className="home-nav" aria-label="Main navigation">
            <a className="home-nav__link is-current" href="#home" aria-label="Home">
              <Home size={16} aria-hidden="true" /><span>Home</span>
            </a>
            <a className="home-nav__link" href="#menu" aria-label="Our menu">
              <Coffee size={16} aria-hidden="true" /><span>Our Menu</span>
            </a>
            <a className="home-nav__link" href="#story" aria-label="Our story">
              <BookOpen size={16} aria-hidden="true" /><span>Our Story</span>
            </a>
            <a className="home-nav__link" href="#visit" aria-label="Visit us">
              <MapPin size={16} aria-hidden="true" /><span>Visit Us</span>
            </a>
          </nav>
          <button type="button" className="home-header__book" onClick={bookToday}>
            Book a Table <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main>
        <section className="home-hero" id="home" aria-labelledby="home-title">
          <img className="home-hero__image" src={heroImage} alt="A warm cafe table beside a sunny window" />
          <div className="home-hero__shade" />
          <div className="home-hero__content">
            <p className="home-eyebrow">A NEIGHBORHOOD CAFE</p>
            <h1 id="home-title">A seat at your<br />corner.</h1>
            <span className="home-gold-rule" />
            <p className="home-hero__intro">Good coffee, good company,<br />your perfect little pause.</p>
            <button type="button" className="home-button home-button--gold" onClick={bookToday}>
              Reserve Your Table <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="home-hero__stamp" aria-hidden="true">
            <span>THE</span><span>CORNER</span><span>CAFE</span>
          </div>
        </section>

        <form className="home-quick-book" onSubmit={handleFindTable} aria-label="Find a table">
          <label className="home-quick-book__field" htmlFor="home-book-date">
            <span>Date</span>
            <span className="home-input-wrap">
              <CalendarDays size={17} aria-hidden="true" />
              <input id="home-book-date" type="date" min={todayAsDateInput()} value={date} onChange={(event) => setDate(event.target.value)} required />
            </span>
          </label>
          <label className="home-quick-book__field" htmlFor="home-book-time">
            <span>Time</span>
            <span className="home-input-wrap">
              <Clock3 size={17} aria-hidden="true" />
              <select id="home-book-time" value={time} onChange={(event) => setTime(event.target.value)}>
                {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </span>
          </label>
          <label className="home-quick-book__field" htmlFor="home-book-guests">
            <span>Guests</span>
            <span className="home-input-wrap">
              <Users size={17} aria-hidden="true" />
              <select id="home-book-guests" value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>
                {Array.from({ length: 8 }, (_, index) => index + 1).map((guests) => (
                  <option key={guests} value={guests}>{guests} {guests === 1 ? 'guest' : 'guests'}</option>
                ))}
              </select>
            </span>
          </label>
          <button className="home-button home-button--gold home-quick-book__submit" type="submit">Find a Table</button>
        </form>

        <section className="home-section home-menu" id="menu" aria-labelledby="menu-title">
          <div className="home-section-heading">
            <div className="home-section-heading__ornament" aria-hidden="true"><span /><Coffee size={25} /><span /></div>
            <p className="home-eyebrow home-eyebrow--dark">GOOD THINGS, MADE FRESH</p>
            <h2 id="menu-title">Made for little moments</h2>
            <p className="home-section-heading__intro">From rich, honest coffee to freshly baked treats and satisfying brunch, our menu is full of simple favorites, done well.</p>
          </div>
          <div className="home-menu-grid">
            {menuCards.map((item) => (
              <article className="home-menu-card" key={item.title}>
                <div className="home-menu-card__photo">
                  <img src={item.image} alt={item.alt} loading="lazy" />
                  <span className="home-menu-card__hover-note"><Clock3 size={14} aria-hidden="true" />{item.detail}</span>
                </div>
                <div className="home-menu-card__info">
                  <span className="home-menu-card__category">THE CORNER CAFE FAVORITES</span>
                  <h3>{item.title}</h3>
                  <span className="home-gold-rule home-gold-rule--small" />
                  <p>{item.description}</p>
                  <strong>{item.price}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-story" id="story" aria-labelledby="story-title">
          <a className="home-story__photo" href="#visit" aria-label="See more about The Corner Cafe">
            <img src={heroImage} alt="The Corner Cafe's sunlit window seating" loading="lazy" />
            <span className="home-story__photo-caption"><strong>A corner with a story</strong><span>Come on in <ArrowRight size={15} aria-hidden="true" /></span></span>
          </a>
          <div className="home-story__copy">
            <span className="home-gold-rule home-gold-rule--small" />
            <p className="home-eyebrow home-eyebrow--dark">A PLACE TO PAUSE</p>
            <h2 id="story-title">A corner with a story</h2>
            <p>The Corner Cafe began with a simple idea: to create a warm, welcoming space where good coffee, great food, and genuine connection come together.</p>
            <p>Today, we’re a neighborhood favorite for morning rituals, midday resets, and shared moments, big and small.</p>
            <a className="home-button home-button--outline" href="#visit">Our Story <ArrowRight size={15} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="home-gallery" aria-label="Moments at The Corner Cafe">
          {galleryImages.map((item) => (
            <figure className="home-gallery__item" key={item.label}>
              <img src={item.image} alt={item.alt} loading="lazy" />
              <figcaption>{item.label}</figcaption>
            </figure>
          ))}
        </section>

        <section className="home-section home-moments" aria-labelledby="moments-title">
          <div className="home-section-heading home-section-heading--compact">
            <div className="home-section-heading__ornament" aria-hidden="true"><span /><Coffee size={25} /><span /></div>
            <p className="home-eyebrow home-eyebrow--dark">A LITTLE MORE TIME</p>
            <h2 id="moments-title">Good things happen over coffee</h2>
          </div>
          <div className="home-moment-grid">
            <article className="home-moment-card">
              <Coffee size={22} aria-hidden="true" />
              <h3>Make room for a slow morning</h3>
              <p>From a familiar espresso to a seasonal pour-over, find a cup that fits your day.</p>
            </article>
            <article className="home-moment-card">
              <Utensils size={22} aria-hidden="true" />
              <h3>Stay for one more bite</h3>
              <p>Fresh pastries, comforting brunch, and a cozy seat make it easy to linger a little longer.</p>
            </article>
          </div>
        </section>

        <section className="home-visit" id="visit" aria-labelledby="visit-title">
          <div className="home-visit__copy">
            <span className="home-gold-rule home-gold-rule--small" />
            <p className="home-eyebrow home-eyebrow--dark">YOUR NEIGHBORHOOD CORNER</p>
            <h2 id="visit-title">Come find your corner</h2>
            <p className="home-visit__intro">A welcoming table is waiting for coffee, a bite, or a little catch-up.</p>
            <div className="home-visit__detail"><MapPin size={19} aria-hidden="true" /><span>The Corner Cafe</span></div>
            <div className="home-visit__detail"><Clock3 size={19} aria-hidden="true" /><span>Open daily · 8:30 AM – 8:30 PM</span></div>
            <button type="button" className="home-button home-button--outline" onClick={bookToday}>Plan your visit <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="home-map-card" role="img" aria-label="Illustrated location card for The Corner Cafe">
            <div className="home-map-card__roads" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div className="home-map-card__label">THE CORNER CAFE</div>
            <MapPin className="home-map-card__pin" size={29} fill="currentColor" aria-hidden="true" />
            <span className="home-map-card__caption">A good place to meet</span>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__top">
          <a className="home-footer__brand" href="#home">THE CORNER CAFE<span className="home-gold-rule home-gold-rule--small" /></a>
          <nav className="home-footer__links" aria-label="Footer navigation">
            <FooterTiltLink href="#home" label="Home" Icon={Home} />
            <FooterTiltLink href="#menu" label="Our Menu" Icon={Coffee} />
            <FooterTiltLink href="#story" label="Our Story" Icon={BookOpen} />
            <FooterTiltLink href="#visit" label="Visit Us" Icon={MapPin} />
          </nav>
          <button type="button" className="home-footer__book" onClick={bookToday}>Book a Table</button>
        </div>
        <p>© {new Date().getFullYear()} The Corner Cafe · Made for little moments.</p>
      </footer>
    </div>
  );
}
