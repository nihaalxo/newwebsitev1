import type { NextPage } from "next"; 
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import styles from "./uiux.module.css";
import useDesignScale from "../hooks/useDesignScale";

// Project interface for type safety
interface Project {
  key: string;
  title: string;
  imgSrc: string;
  imgAlt: string;
  date: string;
  url: string;
}

// Project data array - easy to add/remove projects
const PROJECTS: Project[] = [
  {
    key: "escape-room",
    title: "Escape Room - Game Design",
    imgSrc: "/EscapeRoom-GameDesign.png",
    imgAlt: "",
    date: "2023",
    url: "https://nihaalnazeer.myportfolio.com/escape-room-game-design",
  },
  {
    key: "instagram-redesign",
    title: "Apple Vision - Instagram Redesign",
    imgSrc: "/Apple Vision-InstagramRedesign.png",
    imgAlt: "",
    date: "2023",
    url: "https://nihaalnazeer.myportfolio.com/apple-vision-instagram-redesign",
  },
  {
    key: "green-print",
    title: "Green Print - App Design",
    imgSrc: "/GreenPrint-AppDesign.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/green-print-app-design",
  },
  {
    key: "butterfly-garden",
    title: "Butterfly Garden - UI Design/Animation",
    imgSrc: "/ButterflyGarden-UIDesignAnimation.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/butterfly-garden-ui-designanimation",
  },
  {
    key: "lean-website",
    title: "Lean - Website Design",
    imgSrc: "/Lean-WebsiteDesign.png",
    imgAlt: "",
    date: "2023",
    url: "https://nihaalnazeer.myportfolio.com/lean-website-design",
  },
  {
    key: "ehteraz-app",
    title: "Ehteraz Covid App - Redesign",
    imgSrc: "/EhterazCovidApp-Redesign.png",
    imgAlt: "Ehteraz Covid app redesign",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/ehteraz-covid-app-redesign",
  },
];

// ProjectCard component for consistent styling
const ProjectCard: React.FC<Project> = ({ title, imgSrc, imgAlt, date, url }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
    <div className={styles.card}>
      <div className={styles.cardContent}>
        <Image
          className={styles.cardImage}
          width={729}
          height={554}
          sizes="100vw"
          alt={imgAlt}
          src={imgSrc}
        />
        <div className={styles.dateBox}>
          <div className={styles.date}>{date}</div>
        </div>
      </div>
      <h2 className={styles.cardTitle}>{title}</h2>
    </div>
  </a>
);

const UIUXPage: NextPage = () => {
  const router = useRouter();
  useDesignScale(); // Apply the scaling system

  // Set black background to match container
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#000';
    document.body.style.backgroundColor = '#000';
    
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, []);

  const goBack = () => {
    // Navigate to main page and set portfolio section as active with UI/UX project (button 4)
    router.push('/?section=portfoliosection&button=4');
  };

  const goToNext = () => {
    // Navigate to multidisciplinary page (previous in sequence)
    router.push('/multidisciplinary');
  };

  const goToPrevious = () => {
    // Navigate to immersive page (next in sequence)
    router.push('/immersive');
  };

  return (
    <div className="viewportWrapper">
      {/* Side banners removed - starting fresh */}
      
      <div className="designContainer">
        <div className="relative bg-black w-full text-left text-[32px] text-[#fff] font-[Nasalization]">
          <div className={styles.web19207} style={{ 
            width: '1920px',
            height: '3620px',
            backgroundColor: 'black !important'
          }}>
      <section className={styles.section6} id="uiuxsection" style={{ backgroundColor: 'black' }} />
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon}
        width={730}
        height={554}
        sizes="100vw"
        alt=""
        src="/button4.png"
      />
      <button className={styles.backButton} id="backarrow" onClick={goBack}>
        <Image
          className={styles.backButtonChild}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-61.svg"
        />
        <Image
          className={styles.backButtonItem}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-71.svg"
        />
      </button>
      <h1 className={styles.uiux} id="titletext">
        <p className={styles.nihaal}>UI/UX</p>
      </h1>
      <Image
        className={styles.downArrow}
        width={38}
        height={46}
        sizes="100vw"
        alt="Down Arrow"
        src="/downarrow.png"
      />
      
      {/* CSS Grid container for projects */}
      <div className={styles.projectsGrid}>
        {PROJECTS.map(project => (
          <ProjectCard
            key={project.key}
            title={project.title}
            imgSrc={project.imgSrc}
            imgAlt={project.imgAlt}
            date={project.date}
            url={project.url}
          />
        ))}
      </div>

      <button className={styles.vectorParent} id="leftarrow" onClick={goToPrevious}>
        <Image
          className={styles.groupChild}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-61.svg"
        />
        <Image
          className={styles.groupItem}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-71.svg"
        />
      </button>
      <button className={styles.vectorGroup} id="rightarrow" onClick={goToNext}>
        <Image
          className={styles.groupChild}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-61.svg"
        />
        <Image
          className={styles.groupItem}
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-71.svg"
        />
      </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UIUXPage; 