import type { NextPage } from "next";
import Image from "next/image";
import { useEffect, useRef, useState, useContext } from "react";
import { useRouter } from "next/router";
import emailjs from '@emailjs/browser';
import styles from "./main.module.css";
import useDesignScale from "../hooks/useDesignScale";
import { useVideoSound } from "../hooks/useVideoSound";
import { SoundContext } from "./_app";



const Web19202: NextPage = () => {
  const router = useRouter();
  const { soundEnabled } = useContext(SoundContext);
  const { addVideoRef, videoRefs } = useVideoSound();
  useDesignScale(); // Apply the scaling system

  // Intersection Observer for UI element animations
  useEffect(() => {
    const observerOptions = {
      threshold: 0.3, // Trigger when 30% of the section is visible
      rootMargin: '0px 0px -100px 0px' // Trigger slightly before the section is fully in view
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;
          switch (sectionId) {
            case 'herosection':
              // Hero elements are controlled by timer, not intersection observer
              break;
            case 'aboutsection':
              setShowAboutElements(true);
              setShowAboutLines(true);
              setShowAboutLogo(true);
              break;
            case 'missionssection':
              setShowMissionsElements(true);
              break;
            case 'powerssection':
              setShowPowersElements(true);
              break;
            case 'portfoliosection':
              setShowPortfolioElements(true);
              break;
            case 'tutorialsection':
              setShowTutorialElements(true);
              break;
            case 'contactsection':
              // Contact elements are controlled by video timer, not intersection observer
              break;
          }
        }
      });
    }, observerOptions);

    // Observe all sections
    const sections = [
      'herosection',
      'aboutsection', 
      'missionssection',
      'powerssection',
      'portfoliosection',
      'tutorialsection',
      'contactsection'
    ];

    sections.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);
  
  const videoTimes = useRef<number[]>([]);
  const [showHeroElements, setShowHeroElements] = useState(false);
  const [showAboutElements, setShowAboutElements] = useState(false);
  const [showContactElements, setShowContactElements] = useState(false);
  const [currentPortfolioIndex, setCurrentPortfolioIndex] = useState(1); // Start at 1 for infinite loop
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [showThankYou, setShowThankYou] = useState(false);
  const [showFormElements, setShowFormElements] = useState(true);
  const [showAboutLines, setShowAboutLines] = useState(false);
  const [showAboutLogo, setShowAboutLogo] = useState(false);
  const [showMissionsElements, setShowMissionsElements] = useState(false);
  const [showPowersElements, setShowPowersElements] = useState(false);
  const [showPortfolioElements, setShowPortfolioElements] = useState(false);
  const [showTutorialElements, setShowTutorialElements] = useState(false);

  // Constants for infinite loop
  const SLIDE_COUNT = 4;
  const MAX_IDX = SLIDE_COUNT + 1; // 5

  // Display index that never points at a clone
  const displayIndex =
    currentPortfolioIndex === 0 ? SLIDE_COUNT : // jump clone→real last
      currentPortfolioIndex === MAX_IDX ? 1 : // jump clone→real first
        currentPortfolioIndex;



  // Set main page background
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#000';
    document.body.style.backgroundColor = '#000';
    
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, []);

  // Default scrolling with scaling system

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          const videoIndex = videoRefs.findIndex((v: HTMLVideoElement | null) => v === video);

          if (entry.isIntersecting) {
            // Pause all other videos first
            videoRefs.forEach((otherVideo: HTMLVideoElement | null, index: number) => {
              if (otherVideo && otherVideo !== video) {
                videoTimes.current[index] = otherVideo.currentTime;
                otherVideo.pause();
              }
            });

            // Play this video
            if (videoTimes.current[videoIndex] !== undefined) {
              video.currentTime = videoTimes.current[videoIndex];
            }
            video.play().catch(() => {
              // Handle autoplay restrictions
            });
          } else {
            // Video is going out of view - save current time and pause
            videoTimes.current[videoIndex] = video.currentTime;
            video.pause();
          }
        });
      },
      {
        threshold: 0.5, // Start playing when 50% of video is visible
        rootMargin: "0px 0px -100px 0px" // Start a bit before the video comes into view
      }
    );

    // Observe all videos
    videoRefs.forEach((video: HTMLVideoElement | null) => {
      if (video) {
        observer.observe(video);
      }
    });

    return () => {
      videoRefs.forEach((video: HTMLVideoElement | null) => {
        if (video) {
          observer.unobserve(video);
        }
      });
    };
  }, [soundEnabled]); // Re-run when sound preference changes

  // Timer for hero elements animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHeroElements(true);
    }, 4000); // 4 seconds

    return () => clearTimeout(timer);
  }, []);

  // Timer for contact elements animation
  useEffect(() => {
    const contactVideo = videoRefs[1]; // comp1 video

    const handleVideoPlay = () => {
      console.log('Contact video started playing, starting 8 second timer');
      const timer = setTimeout(() => {
        console.log('Contact elements should appear now');
        setShowContactElements(true);
      }, 8000); // 8 seconds after video starts

      return () => clearTimeout(timer);
    };

    if (contactVideo) {
      contactVideo.addEventListener('play', handleVideoPlay);

      return () => {
        contactVideo.removeEventListener('play', handleVideoPlay);
      };
    }
  }, []);

  // Simple URL parameter handling for initial section
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sectionParam = urlParams.get('section');
    const buttonParam = urlParams.get('button');
    
    if (sectionParam) {
      // Simple scroll to section
      setTimeout(() => {
        const section = document.getElementById(sectionParam);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
    
    if (buttonParam === '3') {
      setCurrentPortfolioIndex(3);
      setWheelRotation(180); // 2 steps clockwise from project 1 to project 3 = 2 * 90 = 180
    }
    if (buttonParam === '4') {
      setCurrentPortfolioIndex(4);
      setWheelRotation(270); // 3 steps clockwise from project 1 to project 4 = 3 * 90 = 270
    }
  }, []);

  // Portfolio navigation functions
  const nextPortfolio = () => {
    setIsTransitioning(true);
    setCurrentPortfolioIndex((prev) => prev + 1);
    setWheelRotation((prev) => prev - 90); // 90 degrees anticlockwise
  };

  const prevPortfolio = () => {
    setIsTransitioning(true);
    setCurrentPortfolioIndex((prev) => prev - 1);
    setWheelRotation((prev) => prev + 90); // 90 degrees clockwise
  };

  // Handle infinite loop transitions
  const handleTransitionEnd = () => {
    // Only jump when landing on a clone
    if (currentPortfolioIndex === 0 || currentPortfolioIndex === MAX_IDX) {
      // Disable the next CSS animation
      setIsTransitioning(false);
      // Because we've just animated **out** to clone, now snap to real:
      const realIndex = currentPortfolioIndex === 0 ? SLIDE_COUNT : 1;
      // Schedule the snap *after* the browser paints the clone
      requestAnimationFrame(() => {
        setCurrentPortfolioIndex(realIndex);
      });
    }
  };

  // Form handling functions
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if all fields are filled
    if (!formData.name || !formData.email || !formData.message) {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Send email using EmailJS
      const result = await emailjs.send(
        'gmail_service', // Your EmailJS service ID
        'template_vzgo2ro', // Your EmailJS template ID
        {
          to_email: 'nihaalnazeerxo@gmail.com',
          from_name: formData.name,
          from_email: formData.email,
          subject: `${formData.name} enquire ${formData.email}`,
          message: formData.message,
        },
        'EOLDK6C9reE-FFuGX' // Your EmailJS public key
      );

      console.log('Email sent successfully:', result);

      // Show thank you message and hide form
      setShowThankYou(true);
      setShowFormElements(false);

      // Clear form after successful submission
      setFormData({
        name: '',
        email: '',
        message: ''
      });

      // Hide thank you message after 7 seconds, then show form elements after 2.2s delay
      setTimeout(() => {
        setShowThankYou(false);
        setTimeout(() => {
          setShowFormElements(true);
        }, 2200);
      }, 7000);

    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send message. Please try again.');
    }
  };



  return (
    <div className="fullscreenWrapper">
      {/* Left Side Banner - positioned 50px outside left edge of viewport */}
      <video
        className="fixed top-0 w-[250px] h-full object-cover z-10"
        muted
        loop
        playsInline
        autoPlay
        style={{ left: '-50px' }}
      >
        <source src="/leftsidebanner.mp4" />
      </video>

      {/* Right Side Banner - positioned 50px outside right edge of viewport */}
      <video
        className="fixed top-0 w-[250px] h-full object-cover z-10"
        muted
        loop
        playsInline
        autoPlay
        style={{ right: '-50px' }}
      >
        <source src="/rightsidebanner.mp4" />
      </video>

      <div className="designContainer">
        <div className="relative bg-black w-full text-left text-[32px] text-[#fff] font-[Nasalization]">
          <section
            className={`relative h-[1080px] w-full bg-[#000] overflow-hidden transition-opacity duration-1000 ease-out`}
            id="herosection"
          >
            <video
              ref={(el) => {
                addVideoRef(el, 0);
              }}
              className="absolute inset-0 w-full h-full object-cover"
              muted={!soundEnabled}
              loop
              playsInline
            >
              <source src="/finalheroshot.compressed.mp4" />
            </video>
            <button
              className={`cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[60px] left-[536px] text-[22px] font-[Nasalization] text-[#fff] text-left inline-block w-[122px] h-[41px] transition-all duration-1000 ease-out hover:scale-105 hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: '0.2s',
                transitionProperty: 'opacity, transform'
              }}
              onClick={() => {
                const aboutSection = document.getElementById('aboutsection');
                if (aboutSection) {
                  aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
        BIODATA
      </button>
            <button
              className={`cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[60px] left-[1007px] text-[22px] font-[Nasalization] text-[#fff] text-left inline-block w-[190px] h-[41px] transition-all duration-1000 ease-out hover:scale-105 hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: '0.4s',
                transitionProperty: 'opacity, transform'
              }}
              onClick={() => {
                const tutorialSection = document.getElementById('tutorialsection');
                if (tutorialSection) {
                  tutorialSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
        SECRET LAIR
      </button>
            <button
              className={`cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[61px] left-[1276px] text-[22px] font-[Nasalization] text-[#fff] text-left inline-block w-[129px] h-[41px] transition-all duration-1000 ease-out hover:scale-105 hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: '0.6s',
                transitionProperty: 'opacity, transform'
              }}
              onClick={() => {
                const contactSection = document.getElementById('contactsection');
                if (contactSection) {
                  contactSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
        CONTACT
      </button>
            <button
              className={`cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[61px] left-[757px] text-[22px] font-[Nasalization] text-[#fff] text-left inline-block w-[152px] h-[41px] transition-all duration-1000 ease-out hover:scale-105 hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)] ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: '0.8s',
                transitionProperty: 'opacity, transform'
              }}
              onClick={() => {
                const portfolioSection = document.getElementById('portfoliosection');
                if (portfolioSection) {
                  portfolioSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
        PORTFOLIO
      </button>
            <div className={`absolute top-[71.5px] left-[91.5px] w-[1737px] h-[5px] overflow-hidden transition-all duration-1000 ease-out ${showHeroElements ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '1.0s' }}>
      <Image
                className="w-full h-full transition-all duration-1000 ease-out"
        width={1737}
        height={5}
        sizes="100vw"
        alt=""
        src="/group-868.svg"
                style={{
                  transform: showHeroElements ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'center'
                }}
      />
            </div>
            <h1 className={`m-0 absolute top-[462px] left-[92px] text-[145px] font-normal font-[inherit] inline-block w-[599px] h-[157px] [filter:drop-shadow(0px_3px_15px_rgba(0,_221,_255,_0.7))] [text-shadow:0_0_20px_rgba(255,255,255,0.6)] [color:rgba(255,255,255,0.75)] [mix-blend-mode:hard-light] transition-all duration-1000 ease-out ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '1.2s' }}>
        <p className="m-0">NIHAAL</p>
      </h1>
            <h1 className={`m-0 absolute top-[462px] right-[90px] text-[145px] font-normal font-[inherit] inline-block w-[647px] h-[157px] [filter:drop-shadow(0px_3px_15px_rgba(0,_221,_255,_0.7))] [text-shadow:0_0_20px_rgba(255,255,255,0.6)] [color:rgba(255,255,255,0.75)] [mix-blend-mode:hard-light] transition-all duration-1000 ease-out ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '1.4s' }}>
        <p className="m-0">NAZEER</p>
      </h1>
            <button className={`cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[960.7px] right-[91.5px] w-[38px] h-[45.6px] transition-all duration-1000 ease-out ${showHeroElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '1.6s' }}>
        <div className="absolute h-[calc(100%_+_5px)] top-[-5px] bottom-[0px] left-[calc(50%_-_5px)] border-[#fff] border-solid border-r-[5px] box-border w-[10px]" />
        <Image
          className="absolute bottom-[-4.6px] left-[-2.5px] w-[26.1px] h-[26.1px]"
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-2.svg"
        />
        <Image
          className="absolute right-[-4.6px] bottom-[-4.6px] w-[26.1px] h-[26.1px]"
          width={26.1}
          height={26.1}
          sizes="100vw"
          alt=""
          src="/line-3.svg"
        />
      </button>
          </section>
          <section
            className={`relative h-[1080px] w-full bg-[#000] flex items-center justify-center overflow-hidden transition-opacity duration-1000 ease-out`}
            id="aboutsection"
          >
            <h2 className="m-0 absolute top-[387px] left-[303px] text-[42px] font-light font-[Gilmer] text-center inline-block w-[1316px] h-[306px]" style={{ zIndex: 10 }}>
              <p className="m-0">
                Future-focused multidisciplinary designer with a passion for immersive
                technology, UI/UX, and storytelling. Creator of an interactive 3D
                portfolio experience that merges spatial computing, real-time
                animation, and intuitive design. Skilled in blending branding, motion
                design, and extended reality (XR) to craft user-centric digital
                experiences across platforms.
              </p>
            </h2>
            
            {/* Animated decorative lines with circular mask */}
            <div className="absolute top-[-1px] left-[-0.35px] w-[1982.5px] h-[1143.6px]" style={{ zIndex: 1 }}>
              <Image
                className="w-full h-full"
                width={1982.5}
                height={1143.6}
                sizes="100vw"
                alt=""
                src="/section2lines.svg"
              />
              {/* Circular mask that shrinks to reveal lines - positioned to only cover the lines area */}
              <div 
                className={`absolute top-0 left-0 w-full h-full bg-black transition-all duration-[3000ms] ease-out ${
                  showAboutLines ? 'scale-0' : 'scale-150'
                }`}
                style={{
                  borderRadius: '50%',
                  transformOrigin: 'center center',
                  zIndex: 2
                }}
              />
            </div>
            
            <Image
              className={`absolute top-[948px] left-[932.41px] w-[55.2px] h-[40.3px] transition-all duration-1000 ease-out ${showAboutLogo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              width={55.2}
              height={40.3}
              sizes="100vw"
              alt=""
              src="/section2logo.svg"
              style={{ zIndex: 10, transitionDelay: '0.5s' }}
            />
          </section>
          <section
            className={`relative h-[1080px] w-full bg-[#000] flex items-center justify-center overflow-hidden transition-opacity duration-1000 ease-out`}
            id="missionssection"
          >
            <Image
              className="absolute top-[-1px] left-[0px] w-[1920px] h-[1080px] object-cover"
              width={1920}
              height={1080}
              sizes="100vw"
              alt=""
              src="/section3missions@2x.png"
            />
            <h3 className={`m-0 absolute top-[878px] left-[854px] text-[length:inherit] font-normal font-[inherit] text-center inline-block w-[210px] h-[89px] [text-shadow:0px_3px_6px_#00fff8] transition-all duration-1000 ease-out ${showMissionsElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.2s' }}>
              <p className="m-0">Immersive Designer</p>
            </h3>
            <h3 className={`m-0 absolute top-[838px] left-[598px] text-[length:inherit] font-normal font-[inherit] text-center inline-block w-[180px] h-[87px] [text-shadow:0px_3px_6px_#00fff8] transition-all duration-1000 ease-out ${showMissionsElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.4s' }}>
              <p className="m-0">Brand Designer</p>
            </h3>
            <h3 className={`m-0 absolute top-[838px] left-[1160px] text-[length:inherit] font-normal font-[inherit] text-center inline-block w-[174px] h-[87px] [text-shadow:0px_3px_6px_#00fff8] transition-all duration-1000 ease-out ${showMissionsElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.6s' }}>
              <p className="m-0">UI/UX Designer</p>
            </h3>
            <h3 className={`m-0 absolute top-[814px] left-[346px] text-[length:inherit] font-normal font-[inherit] text-center inline-block w-[194px] h-[90px] [text-shadow:0px_3px_6px_#00fff8] transition-all duration-1000 ease-out ${showMissionsElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.8s' }}>
              <p className="m-0">Graphic Designer</p>
            </h3>
            <h3 className={`m-0 absolute top-[814px] left-[1410px] text-[length:inherit] font-normal font-[inherit] text-center inline-block w-[124px] h-[87px] [text-shadow:0px_3px_6px_#00fff8] transition-all duration-1000 ease-out ${showMissionsElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '1.0s' }}>
              <p className="m-0">Video Editor</p>
            </h3>
          </section>
          <section
            className={`relative h-[1080px] w-full bg-[#000] overflow-hidden transition-opacity duration-1000 ease-out`}
            id="powerssection"
          >
      <video
              ref={(el) => {
                addVideoRef(el, 3);
              }}
              className="absolute inset-0 w-full h-full object-cover"
        muted={!soundEnabled}
        loop
              playsInline
      >
              <source src="/rotatingpowers0001-0180_(1).mp4" />
      </video>
            <Image
              className="absolute top-[128.47px] left-[552.29px] w-[837.5px] h-[855.5px] [mix-blend-mode:soft-light]"
              width={837.5}
              height={855.5}
              sizes="100vw"
              alt=""
              src="/section4powers.svg"
            />
            <h4 className={`m-0 absolute top-[998px] left-[60px] text-2xl font-normal font-[inherit] inline-block w-[542px] h-[30px] transition-all duration-1000 ease-out ${showPowersElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.2s' }}>
              <p className="m-0">BA Hons : Graphic and Media Design | UAL</p>
            </h4>
            <h4 className={`m-0 absolute top-[1000px] right-[59px] text-2xl font-normal font-[inherit] inline-block w-[513px] h-[27px] transition-all duration-1000 ease-out ${showPowersElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.4s' }}>
              <p className="m-0">CertHE : Design, Screen and Media | UAL</p>
            </h4>
          </section>

          {/* Powers Banner - positioned at border between missions and powers sections */}
          <img
            className="absolute z-50"
            style={{
              top: '3160px',
              left: '50%',
              width: '2264.33px',
              height: '223.59px',
              transformOrigin: 'center center',
              transform: `translateX(-50%)`
            }}
            alt="Powers Banner"
            src="/powers banner.png"
          />

      <section
            className={`relative h-[1080px] w-full bg-[#000] flex items-center justify-center overflow-hidden transition-opacity duration-1000 ease-out`}
        id="portfoliosection"
          >
            <h1 className={`m-0 absolute top-[37px] left-[363px] text-[200px] font-normal font-[inherit] inline-block w-[1196px] h-[230px] transition-all duration-1000 ease-out ${showPortfolioElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.2s' }}>
        <p className="m-0">PORTFOLIO</p>
      </h1>
            <div className="absolute top-[155px] left-[0px] w-[1920px] h-[554px] overflow-hidden">
              <div
                className="flex"
                onTransitionEnd={handleTransitionEnd}
                style={{
                  transform: `translateX(${595.5 - (currentPortfolioIndex * 833.5)}px)`,
                  width: 'calc(6 * 729px + 5 * 104.5px)',
                  height: '100%',
                  transition: isTransitioning ? 'transform 0.5s ease-out' : 'none'
                }}
              >
                {/* Clone of last slide (button4) */}
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 transition-all duration-500 ${displayIndex === 4
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button4.png')`,
                    opacity: displayIndex === 4 ? 1 : 0.5
                  }}
                />
                {/* Original slides */}
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 ml-[104.5px] transition-all duration-500 ${displayIndex === 1
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button1.png')`,
                    opacity: displayIndex === 1 ? 1 : 0.5
                  }}
                  onClick={() => {
                    router.push('/immersive');
                  }}
                />
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 ml-[104.5px] transition-all duration-500 ${displayIndex === 2
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button2.png')`,
                    opacity: displayIndex === 2 ? 1 : 0.5
                  }}
                  onClick={() => {
                    router.push('/branding');
                  }}
                />
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 ml-[104.5px] transition-all duration-500 ${displayIndex === 3
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button3.png')`,
                    opacity: displayIndex === 3 ? 1 : 0.5
                  }}
                  onClick={() => {
                    router.push('/multidisciplinary');
                  }}
                />
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 ml-[104.5px] transition-all duration-500 ${displayIndex === 4
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button4.png')`,
                    opacity: displayIndex === 4 ? 1 : 0.5
                  }}
                  onClick={() => {
                    router.push('/uiux');
                  }}
                />
                {/* Clone of first slide (button1) */}
                <button
                  className={`cursor-pointer [border:none] p-0 bg-[transparent] rounded-[59px] bg-cover bg-no-repeat bg-[top] w-[729px] flex-shrink-0 ml-[104.5px] transition-all duration-500 ${displayIndex === 1
                      ? 'h-full'
                      : 'h-[calc(100%_-_82px)] mt-[41px] mb-[41px]'
                    }`}
                  style={{
                    backgroundImage: `url('/button1.png')`,
                    opacity: displayIndex === 1 ? 1 : 0.5
                  }}
                />
              </div>
      </div>
            <div
              className="absolute top-[779.57px] left-[658px] w-[594px] h-[591px]"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: 'transform 0.5s ease-out'
              }}
            >
      <Image
                className="w-full h-full"
        width={594}
        height={591}
        sizes="100vw"
        alt=""
        src="/section5textwheel.svg"
      />
            </div>
            <button
              className="cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[377px] right-[126px] w-[55px] h-[105px] transition-all duration-300 hover:scale-110"
              onClick={nextPortfolio}
            >
        <Image
          className="absolute w-full top-[0px] right-[0px] left-[0px] max-w-full overflow-hidden h-[55px]"
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-6.svg"
        />
        <Image
          className="absolute w-full right-[0px] bottom-[0px] left-[0px] max-w-full overflow-hidden h-[55px]"
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-7.svg"
        />
      </button>
            <button
              className="cursor-pointer [border:none] p-0 bg-[transparent] absolute top-[377px] left-[127px] w-[55px] h-[105px] transition-all duration-300 hover:scale-110"
              onClick={prevPortfolio}
            >
        <Image
          className="absolute w-full top-[0px] right-[0px] left-[0px] max-w-full overflow-hidden h-[55px]"
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-61.svg"
        />
        <Image
          className="absolute w-full right-[0px] bottom-[0px] left-[0px] max-w-full overflow-hidden h-[55px]"
          width={55}
          height={55}
          sizes="100vw"
          alt=""
          src="/line-71.svg"
        />
      </button>
            <div
              className="absolute bottom-[49px] right-[50px] rounded-[23px] w-[389px] h-[194px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            />
            <h4 className={`m-0 absolute bottom-[95px] right-[94px] text-[length:inherit] font-medium font-[Gilmer] inline-block w-[317px] h-[120px] transition-all duration-1000 ease-out ${showPortfolioElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '0.4s' }}>
              <p className="m-0">next page for 3D portfolio experience</p>
              <p className="m-0">(PC only)</p>
            </h4>
          </section>
          <section
            className={`relative h-[1080px] w-full bg-[#000] overflow-hidden transition-opacity duration-1000 ease-out`}
            id="tutorialsection"
          >
      <video
              ref={(el) => {
                addVideoRef(el, 2);
              }}
              className="absolute inset-0 w-full h-full object-cover"
        muted={!soundEnabled}
        loop
              playsInline
      >
        <source src="/tutorialfullanimation0000-3500_2.compressed.mp4" />
      </video>
            <a
              href="https://interactive.nihaalnazeer.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={`absolute bottom-[49px] left-[50px] rounded-[23px] w-[344px] h-[160px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-cyan-400 hover:shadow-[0_8px_32px_rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.3)] transition-all duration-300 cursor-pointer flex items-center justify-center ${showTutorialElements ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.2s' }}
            >
              <h4 className="m-0 text-[length:inherit] font-medium font-[Gilmer] text-center hover:text-cyan-400 transition-colors duration-300">
                <p className="m-0">Enter 3D Website</p>
                <p className="m-0">(PC only)</p>
              </h4>
            </a>
          </section>
          <section
            className={`relative h-[1080px] w-full bg-[#000] transition-opacity duration-1000 ease-out`}
            id="contactsection"
          >
            <video
              ref={(el) => {
                addVideoRef(el, 1);
              }}
              className="absolute inset-0 w-full h-full object-cover"
              muted={!soundEnabled}
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                // Set volume to 50%
                video.volume = 0.5;
                // Set to last frame when metadata is loaded
                video.addEventListener('timeupdate', () => {
                  // Fade out effect - start 5 seconds before the end
                  const fadeStartTime = video.duration - 5; // Start fade 5 seconds before end
                  const currentTime = video.currentTime;
                  
                  if (currentTime >= fadeStartTime) {
                    // Calculate fade progress (0 to 1 over 5 seconds)
                    const fadeProgress = (currentTime - fadeStartTime) / 5;
                    // Fade from 0.5 to 0
                    video.volume = 0.5 * (1 - fadeProgress);
                  } else {
                    // Keep volume at 50% before fade starts
                    video.volume = 0.5;
                  }
                  
                  // Pause at last frame
                  if (video.currentTime >= video.duration - 0.1) {
                    video.pause();
                  }
                });
              }}
            >
              <source src="/comp_1.compressed.mp4" />
            </video>
            <h1 className={`m-0 absolute top-[60px] left-[60px] text-8xl font-normal font-[inherit] inline-block w-[312px] h-[239px] transition-all duration-1000 ease-out ${showContactElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '0.2s' }}>
        Get in Touch
      </h1>
            <div
              className={`absolute top-[298px] left-[60px] rounded-[23px] w-[621px] h-[95px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-1000 ease-out ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.4s' }}
            />
            <div
              className={`absolute top-[408px] left-[60px] rounded-[23px] w-[621px] h-[95px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-1000 ease-out ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.6s' }}
            />
            <div
              className={`absolute top-[518px] left-[60px] rounded-[23px] w-[621px] h-[280px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-1000 ease-out ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.8s' }}
            />
            <input
              className={`[border:none] [outline:none] bg-[transparent] absolute top-[298px] left-[80px] rounded-[23px] w-[581px] h-[95px] transition-all duration-1000 ease-out font-[Gilmer] font-medium text-white z-10 ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.4s' }}
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
            <input
              className={`[border:none] [outline:none] bg-[transparent] absolute top-[408px] left-[80px] rounded-[23px] w-[581px] h-[95px] transition-all duration-1000 ease-out font-[Gilmer] font-medium text-white z-10 ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.6s' }}
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
            <textarea
              className={`[border:none] bg-[transparent] [outline:none] absolute top-[538px] left-[80px] rounded-none w-[581px] h-[240px] transition-all duration-1000 ease-out font-[Gilmer] font-medium text-white resize-none z-10 ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '0.8s' }}
              placeholder="Message"
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
            />

            {/* Thank You Message */}
            <div
              className={`absolute top-[440px] left-[60px] transition-all duration-1000 ease-out ${showContactElements && showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '2.2s' }}
            >
              <p className="text-white text-[34px] font-[Gilmer] font-medium leading-relaxed">
                Thank you for your message.
                <br />
                I will get back to you as soon
                <br />
                as I am done saving the world.
              </p>
            </div>
            <button
              className={`absolute top-[813px] left-[60px] rounded-[23px] w-[621px] h-[95px] bg-[rgba(20,20,20,0.8)] border border-cyan-400/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-cyan-400 hover:shadow-[0_8px_32px_rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.3)] transition-all duration-150 cursor-pointer z-10 ${showContactElements && showFormElements && !showThankYou ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: '1.0s',
                transitionProperty: 'opacity, transform'
              }}
              onClick={handleSubmit}
            >
              <span className="absolute left-[calc(50%-5px)] top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-[32px] font-[Nasalization] uppercase">
                Send
              </span>
            </button>
            <a
              href="https://www.linkedin.com/in/nihaal-nazeer-b6187117a/"
              target="_blank"
              rel="noopener noreferrer"
              className={`[text-decoration:none] absolute bottom-[59px] left-[60px] rounded-2xl w-[95px] h-[95px] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-cyan-400 hover:shadow-[0_8px_32px_rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.3)] transition-all duration-150 cursor-pointer ${showContactElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: showContactElements ? '1.2s' : '0s',
                transitionProperty: 'opacity, transform'
              }}
            >
        <Image
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[33.5px] h-[33.5px]"
          width={35}
          height={33.5}
          sizes="100vw"
                alt="LinkedIn"
          src="/group-3.svg"
        />
      </a>
      <Image
              className={`absolute right-[91.5px] bottom-[73.4px] w-[38px] h-[45.6px] transition-all duration-1000 ease-out transform rotate-180 ${showContactElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{ transitionDelay: '1.6s' }}
              width={38}
              height={45.6}
        sizes="100vw"
              alt="Up arrow"
              src="/downarrow.png"
      />
            <a
              href="mailto:nihaalnazeerxo@gmail.com"
              className={`[text-decoration:none] absolute bottom-[59px] left-[179px] rounded-2xl w-[502px] h-[95px] text-[26px] text-[inherit] font-[Gilmer] [backdrop-filter:blur(20px)] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-cyan-400 hover:shadow-[0_8px_32px_rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.3)] transition-all duration-150 cursor-pointer ${showContactElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                transitionDelay: showContactElements ? '1.4s' : '0s',
                transitionProperty: 'opacity, transform'
              }}
            >
        <Image
                className="absolute top-[calc(50%_-_16.74px)] left-[42.79px] w-[41.8px] h-[33.5px]"
          width={41.8}
          height={33.5}
          sizes="100vw"
                alt="Email"
          src="/path-1.svg"
        />
              <div className="absolute w-[calc(100%_-_130px)] top-[calc(50%_-_17.5px)] left-[106.21px] font-medium inline-block h-[39px]">
          nihaalnazeerxo@gmail.com
        </div>
      </a>
          </section>
        </div>
      </div>

      {/* Side banners removed - starting fresh */}
    </div>
  );
};

export default Web19202;
