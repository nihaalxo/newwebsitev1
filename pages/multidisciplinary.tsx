import type { NextPage } from "next"; 
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import styles from "./multidisciplinary.module.css";
import useDesignScale from "../hooks/useDesignScale";


const MultidisciplinaryPage: NextPage = () => {
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
    window.location.href = '/?section=portfoliosection&button=3';
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
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon1}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/3cbb79e5fa5548ba9ed8dfe948b10a0d-rw-19201@2x.png"
      />
      <Image
        className={styles.nihaalNazeerFootballOnTh}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/nihaal-nazeer--football-on-the-vision-pro--google-chrome-7-15-2025-1-18-42-am@2x.png"
      />
      <Image
        className={styles.a6Fe7546a8B0c34c4fd0846a10Icon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/524185a6fe7546a8b0c34c4fd0846a10-rw-1920@2x.png"
      />
      <Image
        className={styles.nihaalNazeerFootballOnTh1}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/nihaal-nazeer--football-on-the-vision-pro--google-chrome-7-15-2025-1-20-26-am@2x.png"
      />
      <Image
        className={styles.nihaalNazeerFootballOnTh2}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/nihaal-nazeer--football-on-the-vision-pro--google-chrome-7-15-2025-1-21-13-am@2x.png"
      />
      <Image
        className={styles.e5c1ffcDdee46bcAf30F9dd52aIcon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/3e5c1ffcddee46bcaf30f9dd52a41abd-rw-1200@2x.png"
      />
      <Image
        className={styles.a273ec7aa54352B44444e75a92Icon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/57a273ec7aa54352b44444e75a92cdb2-rw-1920@2x.png"
      />
      <button className={styles.vectorParent} id="rightbutton">
        <Image
          className={styles.groupChild}
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-6.svg"
        />
        <Image
          className={styles.groupItem}
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-7.svg"
        />
      </button>
      <button className={styles.vectorGroup} id="leftbutton">
        <Image
          className={styles.groupChild}
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-61.svg"
        />
        <Image
          className={styles.groupItem}
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-71.svg"
        />
      </button>
      <h2 className={styles.fortuneTeller}>
        Fortune Teller - Interactive Pamphlet
      </h2>
      <h2 className={styles.mentalHealth}>Mental Health - Advocate</h2>
      <h2 className={styles.memoryPalace}>Memory Palace - Blender Animation</h2>
      <h2 className={styles.lightAndDark}>Light and Dark - Animation</h2>
      <h2 className={styles.telephonePublication}>
        Telephone - Publication Design
      </h2>
      <h2 className={styles.staticAction}>Static Action - Animation</h2>
      <h2 className={styles.typographicPosters}>Typographic Posters</h2>
      <div className={styles.web19207Child} />
      <div className={styles.web19207Item} />
      <div className={styles.web19207Inner} />
      <div className={styles.rectangleDiv} />
      <div className={styles.div}>2024</div>
      <div className={styles.div1}>2024</div>
      <div className={styles.div2}>2024</div>
      <div className={styles.div3}>2024</div>
      <div className={styles.web19207Child1} />
      <div className={styles.web19207Child2} />
      <div className={styles.web19207Child3} />
      <div className={styles.div4}>2024</div>
      <div className={styles.div5}>2024</div>
      <div className={styles.div6}>2024</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultidisciplinaryPage; 