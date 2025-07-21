import type { NextPage } from "next"; 
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import styles from "./immersive.module.css";
import useDesignScale from "../hooks/useDesignScale";


const ImmersivePage: NextPage = () => {
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
    // Navigate to main page and set portfolio section as active with immersive project (button 1)
    window.location.href = '/?section=portfoliosection&button=1';
  };

  return (
    <div className="viewportWrapper">
      {/* Side banners removed - starting fresh */}
      
      <div className="designContainer">
        <div className="relative bg-black w-full text-left text-[32px] text-[#fff] font-[Nasalization]">
          <div className={styles.web19207} style={{ 
            width: '1920px',
            height: '4262px',
            backgroundColor: 'black !important'
          }}>
      <section className={styles.section6} id="immersivesection" style={{ backgroundColor: 'black' }} />
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon}
        width={730}
        height={554}
        sizes="100vw"
        alt=""
        src="/button1.png"
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
      <h1 className={styles.immersive} id="titletext">
        <p className={styles.nihaal}>IMMERSIVE</p>
      </h1>
      <Image
        className={styles.downArrow}
        width={38}
        height={46}
        sizes="100vw"
        alt="Down Arrow"
        src="/downarrow.png"
      />
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon1}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/Immersive Netflix for Apple's Vision Pro.png"
      />
      <Image
        className={styles.a273ec7aa54352B44444e75a92Icon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/Football On the Vision Pro.png"
      />
      <Image
        className={styles.nihaalNazeerFootballOnTh}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/Immersive Portfolio Website.png"
      />


      <button className={styles.vectorParent} id="leftarrow">
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
      <button className={styles.vectorGroup} id="rightarrow">
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
      <h4 className={styles.fortuneTeller}>
        <p className="m-0">Immersive Netflix for Apple's Vision Pro</p>
      </h4>
      <h4 className={styles.telephonePublication}>
        <p className="m-0">Football On the Vision Pro</p>
      </h4>
      <h4 className={styles.memoryPalace}>
        <p className="m-0">Immersive Portfolio Website</p>
      </h4>
      <div className={styles.web19207Child} />
      <div className={styles.web19207Item} />
      <div className={styles.web19207Inner} />
      <div className={styles.div}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div1}>
        <p className="m-0">2025</p>
      </div>
      <div className={styles.div2}>
        <p className="m-0">2025</p>
      </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ImmersivePage; 