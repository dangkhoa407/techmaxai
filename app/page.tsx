import LandingPage from "./landing-content";
import LoginPage from "./login/page";

export default function Home() {
  return (
    <>
      <div className="home-mobile-login">
        <LoginPage mobileOnly />
      </div>
      <div className="home-desktop-landing">
        <LandingPage skipAuthRedirect />
      </div>
    </>
  );
}
