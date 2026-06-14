import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useLayout } from "../../app/LayoutContext";

const C = {
  primary: "#3878C2",
  cta: "#4BAD40",
  secondary: "#63BCE6",
  white: "#FFFFFF",
  bg: "#EFF8FC",
  dark: "#0D1F35",
  muted: "#6B8BAE",
  softBlue: "rgba(99, 188, 230, 0.16)",
  borderBlue: "rgba(99, 188, 230, 0.25)",
};

const LOADS = [
  {
    name: "Regular Light Mix",
    kg: "Up to 7.5 kg",
    items: "Shirts, blouses/polo, pants, socks, underwear, etc.",
  },
  {
    name: "Heavy Load",
    kg: "Up to 5 kg",
    items: "Beddings, towels, jeans, fleece, regular jackets, etc.",
  },
  {
    name: "Per Piece",
    kg: "₱220 per item",
    items: "Comforter, duvet, pillow, etc.",
  },
];

const STEPS = [
  {
    step: "Step 1",
    title: "Book Online",
    sub: "Schedule your laundry service anytime, anywhere.",
    image: "/images/StepOne.jpg",
    position: "70% 65%",
  },
  {
    step: "Step 2",
    title: "Laundry Pickup",
    sub: "We pick up your laundry at your preferred schedule.",
    image: "/images/StepTwo.jpg",
    position: "70% 90%",
  },
  {
    step: "Step 3",
    title: "Professional Cleaning",
    sub: "Your laundry is washed, dried, and folded with care.",
    image: "/images/StepThree.jpg",
    position: "70% 50%",
    zoom: 1.5,
  },
  {
    step: "Step 4",
    title: "Doorstep Delivery",
    sub: "Clean and fresh laundry are delivered back to you.",
    image: "/images/StepFour.jpg",
    position: "center center",
  },
];

const DEFAULT_FAQS = [
  {
    question: "What are your operating hours?",
    answer:
      "We are open Monday to Saturday, from 8:00 AM to 5:00 PM. Bookings placed outside these hours will be processed the next business day.",
  },
  {
    question: "What types of services do you offer?",
    answer:
      "We offer full service laundry with wash, dry, and fold, including detergent and fabric conditioner.",
  },
  {
    question: "Do you offer pickup and delivery services?",
    answer:
      "Yes. We provide convenient pickup and delivery services. Just place a booking through our app.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept GCash only.",
  },
  {
    question: "Do I need to register to book a service?",
    answer: "Yes, registration is required to book a service.",
  },
  {
    question: "When will my laundry be ready?",
    answer:
      "Bookings placed during operating hours are usually completed within the same day. Bookings placed after 5:00 PM will be processed the next business day.",
  },
  {
    question: "Can I change my account details?",
    answer:
      "Yes. You can update your name, contact number, password, and saved address in the My Profile tab.",
  },
  {
    question: "I forgot my password. What should I do?",
    answer:
      "Tap Forgot Password on the login screen. Enter your email or mobile number to receive a reset link or code, then follow the instructions to set a new password.",
  },
];

const CONTACT = [
  { text: "72 Balite St., Pasay City" },
  { text: "09272276218" },
  { text: "herlandlaundryph@gmail.com" },
];

function WashingMachineIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="30"
        height="30"
        rx="5"
        fill={C.primary}
        opacity="0.12"
        stroke={C.primary}
        strokeWidth="1.8"
      />
      <rect x="7" y="7" width="22" height="5" rx="2" fill={C.primary} opacity="0.18" />
      <circle cx="10.5" cy="9.5" r="1.5" fill={C.primary} />
      <circle cx="18" cy="22" r="7.5" stroke={C.primary} strokeWidth="1.8" fill="none" />
      <circle
        cx="18"
        cy="22"
        r="4.5"
        stroke={C.secondary}
        strokeWidth="1.5"
        fill={C.secondary}
        opacity="0.18"
      />
    </svg>
  );
}

function HeroMachineIllustration() {
  return (
    <div className="hero-visual">
      <div className="hero-circle" />

      <div className="machine-wrap">
        <img
          src="/images/RealisticWashingMachine.png"
          alt="Realistic washing machine"
          className="machine-img"
        />
      </div>

      <span className="bubble b1" />
      <span className="bubble b2" />
      <span className="bubble b3" />
      <span className="bubble b4" />
      <span className="bubble b5" />
      <span className="bubble b6" />
      <span className="bubble b7" />
      <span className="bubble b8" />
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function CheckIcon() {
  return (
    <span className="check-icon" aria-hidden="true">
      ✓
    </span>
  );
}

function StepImage({ item }) {
  return (
    <div className="step-image-wrap">
      <img
        src={item.image}
        alt={item.title}
        className="step-image"
        style={{ objectPosition: item.position }}
      />
    </div>
  );
}

function LogoBubbles() {
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
      <circle cx="28" cy="42" r="20" stroke={C.secondary} strokeWidth="2.5" fill="none" />
      <circle cx="21" cy="36" r="5" stroke={C.secondary} strokeWidth="1.8" fill="none" opacity="0.55" />
      <circle cx="50" cy="22" r="9" stroke={C.secondary} strokeWidth="2.2" fill="none" />
      <circle cx="56" cy="40" r="5" stroke={C.secondary} strokeWidth="1.8" fill="none" opacity="0.7" />
      <circle cx="44" cy="54" r="4" stroke={C.secondary} strokeWidth="1.6" fill="none" opacity="0.55" />
      <circle cx="14" cy="18" r="6" stroke={C.secondary} strokeWidth="1.8" fill="none" opacity="0.65" />
      <circle cx="8" cy="30" r="3" stroke={C.secondary} strokeWidth="1.5" fill="none" opacity="0.45" />
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setHideBottomNav } = useLayout();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingRates, setLoadingRates] = useState(true);
  const [serviceItems, setServiceItems] = useState([]);
  const [loadItems, setLoadItems] = useState(LOADS);
  const [fetchedFaqs, setFetchedFaqs] = useState(DEFAULT_FAQS);
  const [openFaq, setOpenFaq] = useState(0);

  function scrollToHash() {
    if (!location.hash) return;

    const id = location.hash.replace('#', '');
    const section = document.getElementById(id);

    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  useEffect(() => {
    scrollToHash();
  }, [location.pathname, location.hash]);

  useEffect(() => {
    setHideBottomNav(true);
    document.body.classList.add("landing-page-body");

    return () => {
      setHideBottomNav(false);
      document.body.classList.remove("landing-page-body");
    };
  }, [setHideBottomNav]);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!ignore) {
        setIsLoggedIn(!!session);
      }
    }

    async function fetchLandingData() {
      try {
        setLoadingRates(true);

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/services`);
        const data = await response.json();

        const services = data.services || [];
        const faqs = data.faqs || [];
        
        let loadedLoads = (data.loadOptions || [])
          .filter(load => load.isEnabled !== false)
          .map(load => ({
            name: load.label,
            kg: load.sublabel,
            items: load.description,
          }));
          
        if (loadedLoads.length === 0) {
          loadedLoads = LOADS;
        }

        if (!ignore) {
          setServiceItems(services);
          setLoadItems(loadedLoads);

          if (faqs.length > 0) {
            setFetchedFaqs(faqs);
          }
        }
      } catch (error) {
        console.error("Failed to load landing page data:", error);

        if (!ignore) {
          setServiceItems([]);
          setLoadItems(LOADS);
          setFetchedFaqs(DEFAULT_FAQS);
        }
      } finally {
        if (!ignore) {
          setLoadingRates(false);
        }
      }
    }

    checkSession();
    fetchLandingData();

    return () => {
      ignore = true;
    };
  }, []);

  const fullServicePrice = useMemo(() => {
    const fullService = serviceItems.find((item) =>
      String(item.name || "").toLowerCase().includes("full service")
    );

    return fullService?.currentPrice || fullService?.current_price || 220;
  }, [serviceItems]);

  const visibleFaqs = fetchedFaqs.length > 0 ? fetchedFaqs : DEFAULT_FAQS;
  const currentYear = new Date().getFullYear();

  function handleBookNow() {
    if (isLoggedIn) {
      navigate("/book");
    } else {
      navigate("/login?redirect=book");
    }
  }

  function handleNavClick(event, link) {
    if (link.isPage) {
      event.preventDefault();
      navigate(link.href);
    }
  }

  return (
    <div className="landing-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          padding: 0;
          min-height: 100%;
          background: ${C.bg};
        }

        body {
          overflow-x: hidden;
        }

        body.landing-page-body {
          margin: 0 !important;
          padding: 0 !important;
          background: ${C.bg} !important;
        }

        body.landing-page-body #root {
          margin: 0 !important;
          padding: 0 !important;
          background: ${C.bg} !important;
        }

        body.landing-page-body #root > div {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          background: ${C.bg} !important;
        }

        body.landing-page-body [class*="layout"],
        body.landing-page-body [class*="Layout"],
        body.landing-page-body [class*="content"],
        body.landing-page-body [class*="Content"],
        body.landing-page-body [class*="page"],
        body.landing-page-body [class*="Page"],
        body.landing-page-body [class*="main"],
        body.landing-page-body [class*="Main"] {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        body.landing-page-body main {
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }

        html {
          scroll-behavior: smooth;
        }

        .landing-page {
          min-height: 100vh;
          background: ${C.bg};
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: ${C.dark};
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        .section {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 56px;
        }

        .hero-section {
          min-height: calc(100vh - 80px);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: center;
          gap: 28px;
          padding: 72px 56px 72px 140px;
          overflow: hidden;
        }

        .hero-copy {
          max-width: 560px;
        }

        .hero-title {
          font-size: clamp(2rem, 3vw, 3.5rem);
          font-weight: 900;
          color: ${C.dark};
          letter-spacing: -0.04em;
          line-height: 1.1;
          margin: 0 0 22px;
        }

        .hero-title span {
          color: ${C.primary};
        }

        .hero-subtitle {
          font-size: 1.0625rem;
          color: ${C.muted};
          line-height: 1.75;
          max-width: 500px;
          margin: 0 0 36px;
          text-align: justify;
        }

        .primary-button {
          background: ${C.cta};
          color: ${C.white};
          border: none;
          border-radius: 0.75rem;
          padding: 14px 40px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(75, 173, 64, 0.30);
          letter-spacing: -0.01em;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
        }

        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(75, 173, 64, 0.40);
        }

        .hero-visual {
          position: relative;
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateX(80px);
        }

        .hero-circle {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: ${C.softBlue};
          right: -40px;
          z-index: 0;
        }

        .machine-wrap {
          position: relative;
          z-index: 2;
          width: min(450px, 100%);
          filter: drop-shadow(0 24px 40px rgba(56, 120, 194, 0.18));
        }

        .machine-img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
        }

        .bubble {
          position: absolute;
          border-radius: 50%;
          border: 2.5px solid rgba(99, 188, 230, 0.45);
          background: rgba(99, 188, 230, 0.06);
          pointer-events: none;
          z-index: 1;
        }

        .b1 { width: 68px; height: 68px; top: 10%; left: 2%; }
        .b2 { width: 26px; height: 26px; top: 20%; left: 18%; }
        .b3 { width: 14px; height: 14px; top: 32%; left: 6%; }
        .b4 { width: 44px; height: 44px; top: -1%; right: 15%; }
        .b5 { width: 18px; height: 18px; top: 18%; right: 12%; }
        .b6 { width: 30px; height: 30px; top: 42%; right: 22%; }
        .b7 { width: 54px; height: 54px; bottom: 1%; right: 10%; }
        .b8 { width: 38px; height: 38px; bottom: 8%; left: 10%; }

        .eyebrow {
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${C.secondary};
          margin: 0 0 14px;
          text-align: center;
        }

        .section-title {
          font-size: clamp(2rem, 3.5vw, 2.75rem);
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin: 0 0 50px;
          text-align: center;
        }

        .how-section {
          background: ${C.primary};
        }

        .how-section .section-title {
          color: ${C.white};
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          width: 100%;
          max-width: 1100px;
          align-items: stretch;
        }

        .step-card {
          background: ${C.white};
          border-radius: 1.25rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14);
          min-height: 310px;
        }

        .step-image-wrap {
          width: 100%;
          height: 150px;
          overflow: hidden;
          background: rgba(99,188,230,0.14);
          flex-shrink: 0;
        }

        .step-image {
          width: 110%;
          height: 110%;
          display: block;
          object-fit: cover;
          border-radius: 0;
        }

        .step-content {
          padding: 22px 22px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          flex: 1;
        }

        .step-label {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${C.secondary};
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .step-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: ${C.dark};
          letter-spacing: -0.02em;
          line-height: 1.25;
          margin: 0 0 10px;
          flex-shrink: 0;
        }

        .step-sub {
          font-size: 0.875rem;
          color: ${C.muted};
          line-height: 1.65;
          margin: 0;
        }

        .services-section {
          background: ${C.white};
        }

        .services-content {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .card {
          background: ${C.white};
          border-radius: 1rem;
          border: 1px solid rgba(99,188,230,0.28);
          box-shadow: 0 2px 16px rgba(56,120,194,0.08);
        }

        .main-service-card {
          border-left: 4px solid ${C.primary};
          padding: 1.375rem 1.625rem;
        }

        .main-service-layout {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .service-name {
          font-size: 1.125rem;
          font-weight: 800;
          color: ${C.dark};
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }

        .service-description {
          font-size: 0.875rem;
          color: ${C.muted};
          margin: 0 0 14px;
        }

        .price-box {
          text-align: right;
          flex-shrink: 0;
        }

        .price {
          font-size: 2.5rem;
          font-weight: 900;
          color: ${C.primary};
          letter-spacing: -0.04em;
          line-height: 1;
          margin: 0;
        }

        .price-label {
          font-size: 0.8125rem;
          color: ${C.muted};
          margin: 2px 0 16px;
        }

        .small-button {
          background: ${C.cta};
          color: ${C.white};
          border: none;
          border-radius: 0.625rem;
          padding: 10px 28px;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(75,173,64,0.30);
          transition: transform 0.15s, box-shadow 0.15s;
          white-space: nowrap;
        }

        .small-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(75,173,64,0.42);
        }

        .load-label {
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9ca3af;
          margin: 8px 0 2px;
          padding-left: 2px;
        }

        .loads-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .load-card {
          padding: 1.25rem 1.375rem;
        }

        .load-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .load-name {
          font-size: 1rem;
          font-weight: 700;
          color: ${C.dark};
          letter-spacing: -0.01em;
          margin: 0;
        }

        .kg-pill {
          font-size: 0.8rem;
          font-weight: 700;
          color: ${C.primary};
          background: rgba(56,120,194,0.09);
          border: 1px solid rgba(56,120,194,0.18);
          border-radius: 0.4rem;
          padding: 2px 9px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .divider {
          height: 1px;
          background: rgba(99,188,230,0.18);
          margin-bottom: 10px;
        }

        .load-items {
          font-size: 0.84375rem;
          color: ${C.muted};
          line-height: 1.6;
          margin: 0;
        }

        .faq-section {
          background: ${C.bg};
        }

        .faq-wrap {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .faq-item {
          background: ${C.white};
          border: 1px solid rgba(99,188,230,0.25);
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(56,120,194,0.06);
        }

        .faq-question {
          width: 100%;
          background: transparent;
          border: none;
          padding: 20px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          text-align: left;
          cursor: pointer;
          color: ${C.dark};
          font-size: 1rem;
          font-weight: 800;
        }

        .faq-toggle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(56,120,194,0.08);
          color: ${C.primary};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 1.2rem;
          line-height: 1;
        }

        .faq-answer {
          padding: 0 22px 20px;
          color: ${C.muted};
          line-height: 1.75;
          font-size: 0.925rem;
        }

        .footer {
          background: ${C.bg};
          border-top: 1px solid rgba(99,188,230,0.18);
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        .footer-body {
          max-width: 1400px;
          margin: 0 auto;
          padding: 64px 56px 48px;
          display: grid;
          grid-template-columns: 1.5fr 1fr 1.4fr;
          gap: 150px;
          align-items: start;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .footer-logo-img {
          height: 70px;
          width: auto;
          object-fit: contain;
        }

        .footer-brand-main,
        .footer-brand-sub {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin: 0;
        }

        .footer-brand-main {
          color: ${C.primary};
        }

        .footer-brand-sub {
          color: ${C.secondary};
        }

        .footer-text {
          font-size: 0.875rem;
          color: ${C.muted};
          line-height: 1.75;
          max-width: 260px;
          margin: 0;
        }

        .footer-heading {
          font-size: 0.875rem;
          font-weight: 800;
          color: ${C.dark};
          letter-spacing: -0.01em;
          margin: 0 0 20px;
        }

        .footer-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .footer-links-grid {
          display: grid;
          grid-template-columns: auto auto;
          column-gap: 34px;
          row-gap: 12px;
          align-items: start;
        }        

        .footer-link {
          font-size: 0.9rem;
          color: ${C.muted};
          text-decoration: none;
          font-weight: 400;
          transition: color 0.15s;
        }

        .footer-link:hover {
          color: ${C.primary};
        }

        .contact-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .contact-text {
          font-size: 0.875rem;
          color: ${C.muted};
          line-height: 1.6;
          padding-top: 6px;
        }

        .footer-bottom {
          border-top: 1px solid rgba(99,188,230,0.18);
          padding: 16px 56px;
          width: 100%;
          text-align: center;
          margin-bottom: 0 !important;
          background: ${C.bg};
        }

        .footer-bottom p {
          max-width: 1100px;
          margin: 0 auto;
          font-size: 0.8125rem;
          color: ${C.muted};
        }        

        @media (max-width: 1050px) {
          .hero-section {
            grid-template-columns: 1fr;
            padding: 56px 28px;
            text-align: center;
          }

          .hero-copy {
            margin: 0 auto;
          }

          .hero-subtitle {
            margin-left: auto;
            margin-right: auto;
          }

          .hero-visual {
            display: none;
          }

          .section {
            padding: 72px 28px;
          }

          .steps-grid,
          .loads-grid {
            grid-template-columns: 1fr 1fr;
          }

          .footer-body {
            grid-template-columns: 1fr;
            padding: 56px 28px 40px;
          }
        }

        @media (max-width: 720px) {
          .main-service-layout {
            flex-direction: column;
            align-items: flex-start;
          }

          .price-box {
            text-align: left;
          }

          .steps-grid,
          .loads-grid {
            grid-template-columns: 1fr;
          }

          .hero-circle {
            width: 360px;
            height: 360px;
          }
        }
      `}</style>

      <main id="home" className="hero-section">
        <div className="hero-copy">
          <h1 className="hero-title">
            Fast. Fresh. <span>Hassle-free</span>
            <br />
            laundry services.
          </h1>

          <p className="hero-subtitle">
            Keep your clothes fresh without interrupting your day. Herland Laundry brings dependable
            online laundry service closer to you, making every wash easier and more convenient.
          </p>

          <button type="button" className="primary-button" onClick={handleBookNow}>
            Book Now
          </button>
        </div>

        <HeroMachineIllustration />
      </main>

      <section id="services" className="section services-section">
        <p className="eyebrow">Services</p>
        <h2 className="section-title">Our Services</h2>

        <div className="services-content">
          <Card className="main-service-card">
            <div className="main-service-layout">
              <div>
                <p className="service-name">Full Service Laundry</p>
                <p className="service-description">
                  Includes wash, dry, fold, detergent, and fabric conditioner.
                </p>
              </div>

              <div className="price-box">
                <p className="price">₱{fullServicePrice}</p>
                <p className="price-label">/ load</p>
              </div>
            </div>
          </Card>

          <p className="load-label">Load Type</p>

          <div className="loads-grid">
            {loadItems.map((load) => (
              <Card className="load-card" key={load.name}>
                <div className="load-row">
                  <p className="load-name">{load.name}</p>
                  <span className="kg-pill">{load.kg}</span>
                </div>

                <div className="divider" />

                <p className="load-items">{load.items}</p>
              </Card>
            ))}
          </div>

          {loadingRates && (
            <p style={{ color: C.muted, fontSize: "0.875rem", textAlign: "center", marginTop: 12 }}>
              Loading latest service information...
            </p>
          )}
        </div>
      </section>

      <section id="how-it-works" className="section how-section">
        <p className="eyebrow">How It Works</p>
        <h2 className="section-title">Get it done in 4 easy steps</h2>

        <div className="steps-grid">
          {STEPS.map((item) => (
            <div className="step-card" key={item.step}>
              <StepImage item={item} />

              <div className="step-content">
                <span className="step-label">{item.step}</span>
                <p className="step-title">{item.title}</p>
                <p className="step-sub">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="section faq-section">
        <p className="eyebrow">FAQs</p>
        <h2 className="section-title">Frequently Asked Questions</h2>

        <div className="faq-wrap">
          {visibleFaqs.map((faq, index) => {
            const isOpen = openFaq === index;

            return (
              <div className="faq-item" key={faq.id || faq.question || index}>
                <button type="button" className="faq-question" onClick={() => setOpenFaq(isOpen ? null : index)}>
                  <span>{faq.question}</span>
                  <span className="faq-toggle">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen && <div className="faq-answer">{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <footer id="contact" className="footer">
        <div className="footer-body">
          <div>
            <div className="footer-logo">
              <img
                src="/images/SecondaryLogo.png"
                alt="Herland Laundry Logo"
                className="footer-logo-img"
              />
            </div>

            <p className="footer-text">
              Fast, fresh, and hassle-free laundry services delivered right to your door.
            </p>
          </div>

          <div>
            <p className="footer-heading">Quick Links</p>

            <div className="footer-links-grid">
              <a href="#home" className="footer-link">
                Home
              </a>
              <span />

              <a href="#services" className="footer-link">
                Services
              </a>
              <a
                href="/signup"
                className="footer-link"
                onClick={(event) => handleNavClick(event, { href: "/signup", isPage: true })}
              >
                Register
              </a>

              <a href="#how-it-works" className="footer-link">
                How It Works
              </a>
              <a href="#faq" className="footer-link">
                FAQs
              </a>

              <a
                href="/login"
                className="footer-link"
                onClick={(event) => handleNavClick(event, { href: "/login", isPage: true })}
              >
                Login
              </a>
              <a href="#contact" className="footer-link">
                Contact Us
              </a>
            </div>
          </div>              

          <div>
            <p className="footer-heading">Contact Information</p>

            <ul className="footer-list">
              {CONTACT.map((item) => (
                <li className="contact-item" key={item.text}>
                  <span className="contact-text">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {currentYear} Herland Laundry. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}