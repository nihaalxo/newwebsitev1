import type { NextPage } from "next"; 
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import styles from "./branding.module.css";
import useDesignScale from "../hooks/useDesignScale";


const BrandingPage: NextPage = () => {
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
    // Navigate to main page and set portfolio section as active with branding project (button 2)
    window.location.href = '/?section=portfoliosection&button=2';
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
      <section className={styles.section6} id="brandingsection" style={{ backgroundColor: 'black' }} />
      <Image
        className={styles.cbb79e5Fa5548ba9ed8Dfe948bIcon}
        width={730}
        height={554}
        sizes="100vw"
        alt=""
        src="/button2.png"
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
      <h1 className={styles.branding} id="titletext">
        <p className={styles.nihaal}>BRANDING</p>
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
        className={styles.a273ec7aa54352B44444e75a92Icon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/a273ec7aa54352b44444e75a92-rw-1920@2x.png"
      />
      <Image
        className={styles.e5c1ffcDdee46bcAf30F9dd52aIcon}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/e5c1ffcdee46bcaf30f9dd52a-rw-1920@2x.png"
      />
      <Image
        className={styles.nihaalNazeerFootballOnTh2}
        width={729}
        height={554}
        sizes="100vw"
        alt=""
        src="/nihaal-nazeer--football-on-the-vision-pro--google-chrome-7-15-2025-1-20-26-am@2x.png"
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
        <p className="m-0">BRANDING PROJECT 1</p>
      </h4>
      <h4 className={styles.telephonePublication}>
        <p className="m-0">BRANDING PROJECT 2</p>
      </h4>
      <h4 className={styles.memoryPalace}>
        <p className="m-0">BRANDING PROJECT 3</p>
      </h4>
      <h4 className={styles.staticAction}>
        <p className="m-0">BRANDING PROJECT 4</p>
      </h4>
      <h4 className={styles.typographicPosters}>
        <p className="m-0">BRANDING PROJECT 5</p>
      </h4>
      <h4 className={styles.mentalHealth}>
        <p className="m-0">BRANDING PROJECT 6</p>
      </h4>
      <h4 className={styles.lightAndDark}>
        <p className="m-0">BRANDING PROJECT 7</p>
      </h4>
      <div className={styles.web19207Child} />
      <div className={styles.web19207Item} />
      <div className={styles.web19207Inner} />
      <div className={styles.rectangleDiv} />
      <div className={styles.div}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div1}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div2}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div3}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.web19207Child1} />
      <div className={styles.web19207Child2} />
      <div className={styles.web19207Child3} />
      <div className={styles.div4}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div5}>
        <p className="m-0">2024</p>
      </div>
      <div className={styles.div6}>
        <p className="m-0">2024</p>
      </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingPage; 