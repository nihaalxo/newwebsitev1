import type { NextPage } from "next"; 
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import styles from "./multidisciplinary.module.css";
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
    key: "fortune",
    title: "Fortune Teller - Interactive Pamphlet",
    imgSrc: "/FortuneTeller-InteractivePamphlet.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/fortune-teller-interactive-pamphlet",
  },
  {
    key: "telephone",
    title: "Telephone - Publication Design",
    imgSrc: "/Telephone-PublicationDesign.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/telephone-publication-design",
  },
  {
    key: "memory",
    title: "Memory Palace - Blender Animation",
    imgSrc: "/MemoryPalace-BlenderAnimation.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/memory-palace-blender-animation",
  },
  {
    key: "static",
    title: "Static Action - Animation",
    imgSrc: "/StaticAction-Animation.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/static-action-animation",
  },
  {
    key: "light",
    title: "Light and Dark - Animation",
    imgSrc: "/LightandDark-Animation.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/light-and-dark-animation",
  },
  {
    key: "mental",
    title: "Mental Health - Advocate",
    imgSrc: "/MentalHealth-Advocate.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/mental-health-advocate",
  },
  {
    key: "typographic",
    title: "Typographic Posters",
    imgSrc: "/TypographicPosters.png",
    imgAlt: "",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/typographic-posters",
  },
  {
    key: "mind-designer",
    title: "Mind of a Designer - Short Film",
    imgSrc: "/MindofaDesigner-Short Film.png",
    imgAlt: "Mind of a Designer short film",
    date: "2024",
    url: "https://nihaalnazeer.myportfolio.com/mind-of-a-designer-short-film",
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

const MultidisciplinaryPage: NextPage = () => {
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
    // Navigate to main page and set portfolio section as active with multidisciplinary project (button 3)
    router.push('/?section=portfoliosection&button=3');
  };

  const goToNext = () => {
    // Navigate to branding page (previous in sequence)
    router.push('/branding');
  };

  const goToPrevious = () => {
    // Navigate to UI/UX page (next in sequence)
    router.push('/uiux');
  };

  return (
    <div className="viewportWrapper">
      {/* Side banners removed - starting fresh */}
      
      <div className="designContainer">
        <div className="relative bg-black w-full text-left text-[32px] text-[#fff] font-[Nasalization]">
          <div className={styles.web19207} style={{ 
            width: '1920px',
            height: '4378px',
            backgroundColor: 'black !important'
          }}>
      <section className={styles.section6} id="multidisciplinarysection" style={{ backgroundColor: 'black' }} />
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon}
        width={730}
        height={554}
        sizes="100vw"
        alt=""
        src="/3cbb79e5fa5548ba9ed8dfe948b10a0d-rw-1920@2x.png"
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
      <h1 className={styles.multidisciplinary} id="titletext">
        <p className={styles.nihaal}>MULTIDISCIPLINARY</p>
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

export default MultidisciplinaryPage; 