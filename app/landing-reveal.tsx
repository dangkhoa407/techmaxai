"use client";

import { useEffect } from "react";

export default function LandingReveal() {
  useEffect(() => {
    const landing = document.querySelector<HTMLElement>(".landing");
    if (!landing) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const autoRevealSelector = [
      ".landing-header-container > *",
      ".landing-hero-inner > *",
      ".marquee",
      ".marquee .provider-logo",
      ".landing-section > h2",
      ".landing-section > p",
      ".landing-section > .red-line",
      ".landing-grid > *",
      ".landing-grid > * > *",
      ".final-cta > div > *",
      ".corporate-footer .footer-main > *",
      ".corporate-footer .footer-main > * > *",
      ".corporate-footer .footer-bottom",
      ".corporate-footer .footer-bottom > *",
    ].join(",");

    const shouldRevealElement = (element: HTMLElement) =>
      !element.classList.contains("landing-reveal-hook") && !element.closest(".no-reveal");

    const autoElements = Array.from(landing.querySelectorAll<HTMLElement>(autoRevealSelector))
      .filter(shouldRevealElement);

    autoElements.forEach((element) => {
      if (!element.hasAttribute("data-reveal")) {
        element.setAttribute("data-reveal", "auto");
      }
    });

    const groups = Array.from(landing.querySelectorAll<HTMLElement>("header, section, footer"));
    groups.forEach((group) => {
      const children = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]")).filter(shouldRevealElement);
      children.forEach((element, index) => {
        if (!element.style.getPropertyValue("--reveal-delay")) {
          element.style.setProperty("--reveal-delay", `${Math.min(index * 55, 420)}ms`);
        }
      });
    });

    const elements = Array.from(landing.querySelectorAll<HTMLElement>("[data-reveal]")).filter(shouldRevealElement);
    const parallaxElements = prefersReducedMotion
      ? []
      : Array.from(landing.querySelectorAll<HTMLElement>("[data-parallax]")).filter(shouldRevealElement);
    landing?.classList.add("reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );

    elements.forEach((element) => observer.observe(element));

    let frame = 0;
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const updateParallax = () => {
      frame = 0;
      const viewportHeight = window.innerHeight || 1;

      parallaxElements.forEach((element) => {
        const strength = Number(element.dataset.parallax || 0);
        if (!Number.isFinite(strength) || strength === 0) return;

        const rect = element.getBoundingClientRect();
        if (rect.bottom < -viewportHeight * 0.25 || rect.top > viewportHeight * 1.25) return;

        const elementCenter = rect.top + rect.height / 2;
        const progress = clamp((viewportHeight / 2 - elementCenter) / viewportHeight, -1, 1);
        element.style.setProperty("--parallax-y", `${(progress * strength).toFixed(2)}px`);
      });
    };

    const requestParallaxUpdate = () => {
      if (frame || parallaxElements.length === 0) return;
      frame = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestParallaxUpdate);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestParallaxUpdate);
      window.removeEventListener("resize", requestParallaxUpdate);
      parallaxElements.forEach((element) => element.style.removeProperty("--parallax-y"));
      landing?.classList.remove("reveal-ready");
    };
  }, []);

  return <span aria-hidden="true" className="landing-reveal-hook" />;
}
