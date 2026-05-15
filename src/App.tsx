/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  Mail, 
  Phone, 
  Linkedin, 
  Award, 
  Target, 
  Users, 
  Briefcase, 
  ChevronRight, 
  Instagram, 
  Facebook, 
  GraduationCap,
  Lightbulb,
  CheckCircle2,
  Menu,
  X,
  Plus,
  Trash2,
  Edit2,
  LogOut,
  LogIn,
  Save,
  Clock,
  Tag,
  BookOpen,
  Upload,
  Loader2
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth, storage, loginWithGoogle, logout, loginWithEmail, registerWithEmail } from "./lib/firebase";

// --- Types ---
type Language = 'ar' | 'en';

interface Course {
  id?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  imageUrl: string;
  category: string;
  duration: string;
  createdAt?: any;
  updatedAt?: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [siteContent, setSiteContent] = useState<any>(null);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Course>({
    titleAr: '',
    titleEn: '',
    descriptionAr: '',
    descriptionEn: '',
    price: 0,
    imageUrl: '',
    category: '',
    duration: ''
  });

  const isRTL = lang === 'ar';
  const isAdmin = user && (user.email === 'hossamelwardany132@gmail.com' || user.email === 'rhabfaceb9@gmail.com');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setBackendStatus('online');
        else setBackendStatus('offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    checkBackend();

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const unsubscribeCourses = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "courses");
    });

    const configDoc = doc(db, "config", "main");
    const unsubscribeConfig = onSnapshot(configDoc, (snap) => {
      if (snap.exists()) {
        setSiteContent(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "config/main");
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCourses();
      unsubscribeConfig();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      setIsAuthModalOpen(false);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const path = "config/main";
    try {
      await updateDoc(doc(db, "config", "main"), siteContent);
      setIsEditingGlobal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const storageRef = ref(storage, `courses/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload error:", error);
        setUploading(false);
        alert("Failed to upload image.");
      }, 
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
          setUploading(false);
        });
      }
    );
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || uploading) return;

    let path = "courses";
    try {
      if (editingCourse?.id) {
        path = `courses/${editingCourse.id}`;
        const courseRef = doc(db, "courses", editingCourse.id);
        await updateDoc(courseRef, {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "courses"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingCourse(null);
      setUploadProgress(0);
      setFormData({
        titleAr: '',
        titleEn: '',
        descriptionAr: '',
        descriptionEn: '',
        price: 0,
        imageUrl: '',
        category: '',
        duration: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!isAdmin || !window.confirm("Are you sure?")) return;
    const path = `courses/${id}`;
    try {
      await deleteDoc(doc(db, "courses", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData(course);
    setIsModalOpen(true);
  };

  const toggleLang = () => setLang(prev => prev === 'ar' ? 'en' : 'ar');

  const content = {
    ar: {
      name: "رحاب أحمد علي ياسين",
      title: "استراتيجية تسويق رقمي | مديرة تدريب | مؤسسة رحاب كمبنى و CFBL Academy",
      aboutTitle: "من هي رحاب أحمد علي؟",
      aboutText: "رحاب أحمد علي ياسين هي واحدة من الأسماء الصاعدة بقوة في مجال التسويق الإلكتروني والتدريب المهني في الوطن العربي، حيث تجمع بين الخبرة العملية، الرؤية التطويرية الحديثة، والقدرة على تحويل المعرفة إلى نتائج حقيقية قابلة للتطبيق داخل سوق العمل.",
      mission: "تؤمن رحاب بأن التدريب الحقيقي لا يعتمد فقط على نقل المعلومات، بل على بناء عقلية احترافية قادرة على التفكير، التحليل، التنفيذ، وصناعة الفرص.",
      visionTitle: "الرؤية المهنية",
      visionText: "تسعى رحاب إلى بناء نموذج تدريبي عربي حديث يربط بين التعليم الأكاديمي والتطبيق العملي، ويمنح المتدربين الخبرة الحقيقية التي يحتاجها سوق العمل في مجالات التسويق، إدارة الأعمال، وصناعة المحتوى.",
      roles: [
        { title: "مؤسس ومالك رحاب كمبنى و CFBL Academy", icon: <Award className="w-5 h-5" /> },
        { title: "مديرة التدريب في مؤسسة CFBL Academy", icon: <GraduationCap className="w-5 h-5" /> },
        { title: "أخصائية تسويق رقمي", icon: <Target className="w-5 h-5" /> },
        { title: "مدربة محترفة ومطورة برامج تعليمية", icon: <Users className="w-5 h-5" /> },
        { title: "استشارية تسويق وصناعة محتوى", icon: <Lightbulb className="w-5 h-5" /> },
      ],
      expertise: [
        "التسويق الإلكتروني وإدارة الحملات الرقمية",
        "صناعة المحتوى الاحترافي وبناء الهوية التسويقية",
        "إعداد وإدارة الدبلومات المهنية والبرامج التدريبية",
        "تطوير الأنظمة التعليمية والتشغيلية",
        "إدارة فرق العمل والتطوير المؤسسي",
        "التسويق للشركات والمدربين ورواد الأعمال",
        "بناء استراتيجيات التسويق بالمحتوى",
        "تطوير مهارات التواصل والعرض والإقناع"
      ],
      whyMe: [
        "محتوى حديث ومتجدد",
        "أسلوب شرح عملي واحترافي",
        "ربط التدريب بسوق العمل",
        "بناء الهوية المهنية للمتدرب",
        "دعم التفكير الإبداعي والتطبيقي",
        "تطوير المهارات الشخصية والمهنية معًا"
      ],
      philosophy: "تعتمد رحاب في التدريب على الدمج بين التطبيق العملي، التفكير التسويقي الحديث، والتحليل الاستراتيجي لبناء المهارات الحقيقية.",
      contact: "تواصل معي",
      cta: "ابدأ رحابة نجاحك اليوم",
      coursesTitle: "الكورسات والبرامج المهنية",
      addCourse: "إضافة كورس جديد",
      editCourse: "تعديل الكورس",
      deleteCourse: "حذف",
      price: "السعر",
      duration: "المدة",
      category: "الفئة",
      save: "حفظ الكورس",
      cancel: "إلغاء",
      noCourses: "لا توجد كورسات متاحة حالياً."
    },
    en: {
      name: "Rehab Ahmed Ali Yassein",
      title: "Digital Marketing Strategist | Training Manager | Founder of Rehab Company & CFBL Academy",
      aboutTitle: "Who is Rehab Ahmed Ali?",
      aboutText: "Rehab Ahmed Ali Yassein is a leading name in Digital Marketing and Professional Training in the Arab world, blending practical experience with modern visionary development to transform knowledge into real results.",
      mission: "Rehab believes that true training isn't just about transferring information, but about building a professional mindset capable of thinking, analyzing, and execution.",
      visionTitle: "Professional Vision",
      visionText: "She strives to build a modern Arabic training model that bridges academic education and practical application, providing students with real-world experience needed in marketing and business.",
      roles: [
        { title: "Founder & Owner of Rehab Company & CFBL Academy", icon: <Award className="w-5 h-5" /> },
        { title: "Training Manager at CFBL Academy", icon: <GraduationCap className="w-5 h-5" /> },
        { title: "Digital Marketing Specialist", icon: <Target className="w-5 h-5" /> },
        { title: "Professional Trainer & Developer", icon: <Users className="w-5 h-5" /> },
        { title: "Marketing & Content Consultant", icon: <Lightbulb className="w-5 h-5" /> },
      ],
      expertise: [
        "Digital Marketing & Campaign Management",
        "Content Creation & Brand Identity",
        "Professional Diploma Management",
        "Educational & Operational Systems",
        "Team Leadership & Institutional Growth",
        "Consultancy for Entrepreneurs",
        "Content Marketing Strategies",
        "Communication & Persuasion Skills"
      ],
      whyMe: [
        "Modern & Updated Content",
        "Practical & Professional Methods",
        "Market-Ready Training",
        "Professional Identity Building",
        "Creative Thinking Support",
        "Soft & Hard Skills Integration"
      ],
      philosophy: "Training philosophy integrates practical application, modern marketing thinking, and strategic analysis for real skill acquisition.",
      contact: "Get in Touch",
      cta: "Build Your Future Today",
      coursesTitle: "Professional Courses",
      addCourse: "Add New Course",
      editCourse: "Edit Course",
      deleteCourse: "Delete",
      price: "Price",
      duration: "Duration",
      category: "Category",
      save: "Save Course",
      cancel: "Cancel",
      noCourses: "No courses available at the moment."
    }
  };

  const current = content[lang];
  const display = {
    ...current,
    name: siteContent?.[`heroName${lang === 'ar' ? 'Ar' : 'En'}`] || current.name,
    title: siteContent?.[`heroTitle${lang === 'ar' ? 'Ar' : 'En'}`] || current.title,
    aboutText: siteContent?.[`aboutText${lang === 'ar' ? 'Ar' : 'En'}`] || current.aboutText,
    visionText: siteContent?.[`visionText${lang === 'ar' ? 'Ar' : 'En'}`] || current.visionText,
  };

  return (
    <div className={`min-h-screen selection:bg-natural-sage selection:text-white ${isRTL ? 'font-arabic' : 'font-sans'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-natural-bg/80 backdrop-blur-md border-b border-natural-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-natural-sage flex items-center justify-center rounded-full text-white font-bold text-xl">R</div>
            <div className="flex flex-col">
              <span className={`text-natural-text font-bold text-sm tracking-widest uppercase ${isRTL ? 'font-arabic' : 'font-sans'}`}>
                {isRTL ? 'رحاب أحمد' : 'REHAB AHMED'}
              </span>
              <span className="text-[10px] text-natural-muted tracking-widest uppercase">CFBL Academy</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={toggleLang}
              className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-natural-muted hover:text-natural-text transition-colors"
            >
              <Globe className="w-4 h-4" />
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
            {user ? (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${backendStatus === 'online' ? 'border-green-200 text-green-600 bg-green-50' : 'border-red-200 text-red-600 bg-red-50'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      {backendStatus === 'online' ? 'Server Live' : 'Server Down'}
                    </div>
                    <button 
                      onClick={() => setIsEditingGlobal(!isEditingGlobal)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${isEditingGlobal ? 'bg-red-500 text-white' : 'bg-natural-light text-natural-sage border border-natural-sage'}`}
                    >
                      {isEditingGlobal ? (isRTL ? 'إلغاء التعديل' : 'Cancel Edit') : (isRTL ? 'تعديل الموقع' : 'Edit Site')}
                    </button>
                  </div>
                )}
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-natural-muted hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-natural-muted hover:text-[#004d40] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {isRTL ? 'دخول' : 'Login'}
              </button>
            )}
            <a href="#contact" className="px-5 py-2 bg-natural-sage text-white rounded-full text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-all">
              {display.contact}
            </a>
          </div>

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Sidebar */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-natural-text/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-72 bg-natural-sage text-white shadow-2xl flex flex-col`}
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white text-natural-sage flex items-center justify-center rounded-full font-bold text-lg">R</div>
                  <span className="text-xs font-bold tracking-widest uppercase">Menu</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => { toggleLang(); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    {lang === 'ar' ? 'English' : 'العربية'}
                  </button>
                  
                  {user && (
                    <button 
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="flex items-center gap-3 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-red-300 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {isRTL ? 'خروج' : 'Logout'}
                    </button>
                  )}
                  
                  {!user && (
                    <button 
                      onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                      className="flex items-center gap-3 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-white transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      {isRTL ? 'دخول' : 'Login'}
                    </button>
                  )}
                </div>

                <nav className="flex flex-col gap-6 pt-8 border-t border-white/10">
                  {[
                    { label: isRTL ? 'من هي رحاب؟' : 'Who is Rehab?', href: '#' },
                    { label: isRTL ? 'الخبرات' : 'Expertise', href: '#' },
                    { label: isRTL ? 'الدورات' : 'Courses', href: '#' },
                    { label: isRTL ? 'تواصل معي' : 'Contact', href: '#contact' }
                  ].map((link, i) => (
                    <a 
                      key={i} 
                      href={link.href} 
                      onClick={() => setIsMenuOpen(false)}
                      className="text-lg font-bold hover:translate-x-2 transition-transform"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="p-8 bg-black/20 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Follow Me</p>
                <div className="flex justify-center gap-6">
                   <a href="https://www.linkedin.com/in/rehab-ahmed-ali-674387232" className="text-white/70 hover:text-white transition-colors"><Linkedin className="w-4 h-4" /></a>
                   <a href="https://www.facebook.com/share/1FkaGiCwcS/" className="text-white/70 hover:text-white transition-colors"><Facebook className="w-5 h-5" /></a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="pt-20 border-b border-natural-border">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-0 items-stretch min-h-[80vh]">
          <motion.div 
            initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 p-8 md:p-16 flex flex-col justify-center border-natural-border lg:border-r rtl:lg:border-r-0 rtl:lg:border-l"
          >
            <span className="inline-block px-3 py-1 bg-natural-light text-natural-sage text-[10px] font-bold tracking-widest uppercase rounded mb-6 w-fit">
              {isRTL ? "خبير تسويق وتدريب" : "Digital Marketing Strategist & Training Manager"}
            </span>
            <h1 className={`text-6xl md:text-8xl font-bold text-natural-text leading-[0.9] mb-8 tracking-tighter ${isRTL ? 'font-arabic' : 'font-display'}`}>
              {isRTL ? (display.name.includes('<br/>') ? <span dangerouslySetInnerHTML={{__html: display.name}} /> : display.name) : display.name}
            </h1>
            <p className="text-xl text-natural-muted font-light leading-relaxed max-w-lg mb-10 italic">
              "{display.mission}"
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="px-8 py-4 bg-natural-text text-white rounded-xl font-bold tracking-widest uppercase text-xs hover:bg-black transition-all flex items-center gap-2 group">
                {display.cta}
                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="lg:col-span-5 bg-[#F7F3EF] p-8 md:p-16 flex flex-col justify-center relative overflow-hidden"
          >
            {/* Spinning decorative orbit element */}
            <div className="absolute top-10 right-10 p-6 hidden md:block">
              <div className="w-16 h-16 border-2 border-natural-sage border-dashed rounded-full animate-spin-slow"></div>
            </div>
            
            <div className="aspect-square bg-white border border-natural-border rounded-[40px] overflow-hidden shadow-sm relative z-10 flex flex-col items-center justify-center p-8">
               <div className="text-center">
                <span className="text-8xl leading-none mb-6 block">🎓</span>
                <h2 className={`text-3xl italic text-natural-text mb-2 ${isRTL ? 'font-arabic' : 'font-display'}`}>
                  {isRTL ? 'مستشار تدريب دولي' : 'Training Consultant'}
                </h2>
                <p className="text-xs text-natural-muted uppercase tracking-widest font-bold">
                  {isRTL ? 'مدربة محترفة معتمدة' : 'Certified Professional Trainer'}
                </p>
              </div>
            </div>
            
            <div className="mt-12 space-y-4">
              {[
                { label: isRTL ? 'التسويق الرقمي' : 'Digital Marketing', sub: 'STRATEGY & GROWTH' },
                { label: isRTL ? 'إدارة التدريب' : 'Training Management', sub: 'OPERATIONAL SYSTEMS' },
                { label: isRTL ? 'صناعة المحتوى' : 'Content Creation', sub: 'BRAND STORYTELLING' }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b border-natural-border pb-3">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-[10px] text-natural-sage font-mono tracking-tighter uppercase font-bold">{item.sub}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Current Roles */}
      <section className="bg-natural-text py-20 px-6 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
            {display.roles.map((role, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
              >
                <div className="w-10 h-10 bg-natural-sage rounded-full flex items-center justify-center mb-4">
                  {role.icon}
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-white/90">
                  {role.title}
                </h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-sage">Explore</span>
                <h2 className={`text-5xl md:text-6xl font-bold text-natural-text leading-tight ${isRTL ? 'font-arabic' : 'font-display'}`}>
                  {isRTL ? display.aboutTitle : display.aboutTitle}
                </h2>
              </div>
              <p className="text-xl text-natural-muted font-light leading-relaxed">
                {display.aboutText}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/5] bg-natural-light rounded-[60px] overflow-hidden relative z-10 group">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop" 
                  alt="Rehab Ahmed Ali" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-natural-sage/10 mix-blend-multiply transition-opacity group-hover:opacity-0" />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-natural-light rounded-full -z-10 animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 border-2 border-natural-border rounded-full -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-24 px-6 border-b border-natural-border">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
           <motion.div
            initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <div className="relative">
              <div className="aspect-video bg-natural-light rounded-3xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop" 
                  alt="Workshop Vision" 
                  className="w-full h-full object-cover mix-blend-overlay grayscale opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 -left-8 lg:left-auto lg:w-80 bg-white p-8 rounded-2xl shadow-lg border-l-4 border-natural-sage">
                <p className="text-natural-muted font-serif italic leading-relaxed text-sm">
                  "{display.mission}"
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="mb-4 inline-block px-3 py-1 bg-natural-light text-natural-sage text-[10px] font-bold tracking-widest uppercase rounded">
              {display.visionTitle}
            </div>
            <h2 className={`text-4xl md:text-5xl font-bold mb-8 text-natural-text leading-tight ${isRTL ? 'font-arabic' : 'font-display'}`}>
              {display.visionText.split(' ').slice(0, 5).join(' ')}...
            </h2>
            <p className="text-lg text-natural-muted font-light leading-relaxed mb-8">
              {display.visionText}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {display.whyMe.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white border border-natural-border rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-natural-sage" />
                  <span className="text-xs font-bold uppercase tracking-wider text-natural-text">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Expertise */}
      <section className="py-24 px-6 bg-[#F7F3EF]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <span className="text-[10px] font-bold tracking-widest uppercase text-natural-sage block mb-4">Core Focus</span>
              <h2 className={`text-5xl font-bold text-natural-text ${isRTL ? 'font-arabic' : 'font-display'}`}>
                {isRTL ? 'الخبرات الاحترافية' : 'Professional Expertise'}
              </h2>
            </div>
            <p className="text-natural-muted text-sm max-w-xs uppercase tracking-widest font-bold">
              {display.philosophy}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0 border border-natural-border bg-natural-border">
            {display.expertise.map((item, i) => (
              <motion.div 
                key={i}
                whileHover={{ backgroundColor: '#ffffff' }}
                className="p-10 bg-natural-bg/50 flex flex-col gap-6 group transition-all"
              >
                <div className="text-natural-muted font-mono text-xs opacity-50">/ 0{i + 1}</div>
                <p className="font-bold text-natural-text leading-tight uppercase tracking-tight group-hover:text-natural-sage transition-colors">
                  {item}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Qualifications Section */}
      {/* ... code above ... */}

      {/* Courses Section */}
      <section className="py-24 px-6 bg-natural-light/30 border-t border-natural-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <span className="text-[10px] font-bold tracking-widest uppercase text-natural-sage block mb-4">Learning</span>
              <h2 className={`text-5xl font-bold text-natural-text ${isRTL ? 'font-arabic' : 'font-display'}`}>
                {display.coursesTitle}
              </h2>
            </div>
            {isAdmin && (
              <button 
                onClick={() => { setEditingCourse(null); setFormData({ titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', price: 0, imageUrl: '', category: '', duration: '' }); setIsModalOpen(true); }}
                className="px-6 py-3 bg-natural-sage text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {display.addCourse}
              </button>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-natural-border">
              <BookOpen className="w-12 h-12 text-natural-muted/20 mx-auto mb-4" />
              <p className="text-natural-muted uppercase text-xs font-bold tracking-widest">{display.noCourses}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course) => (
                <motion.div 
                  key={course.id}
                  layout
                  className="bg-white rounded-[32px] overflow-hidden border border-natural-border shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className="aspect-video relative overflow-hidden bg-natural-light">
                    {course.imageUrl ? (
                      <img src={course.imageUrl} alt={isRTL ? course.titleAr : course.titleEn} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-natural-muted/20">
                        <Award className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-widest text-natural-sage">
                      {course.category}
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className={`text-xl font-bold text-natural-text mb-4 ${isRTL ? 'font-arabic' : 'font-sans'}`}>
                      {isRTL ? course.titleAr : course.titleEn}
                    </h3>
                    <p className="text-sm text-natural-muted line-clamp-3 mb-6 font-light leading-relaxed">
                      {isRTL ? course.descriptionAr : course.descriptionEn}
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-natural-border">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-natural-muted uppercase font-bold tracking-widest">{display.price}</span>
                        <span className="font-bold text-natural-text">{course.price > 0 ? `${course.price} EGP` : (isRTL ? 'مجاني' : 'Free')}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-right rtl:text-left">
                        <span className="text-[10px] text-natural-muted uppercase font-bold tracking-widest">{display.duration}</span>
                        <span className="font-bold text-natural-text">{course.duration}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2 mt-6 pt-6 border-t border-natural-border">
                        <button 
                          onClick={() => openEditModal(course)}
                          className="flex-1 py-2 bg-natural-light text-natural-text rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-natural-sage hover:text-white transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                          {isRTL ? 'تعديل' : 'Edit'}
                        </button>
                        <button 
                          onClick={() => course.id && handleDeleteCourse(course.id)}
                          className="py-2 px-4 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-natural-text/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-10"
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-natural-sage text-white rounded-full flex items-center justify-center mx-auto mb-6">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h2 className={`text-3xl font-bold mb-2 ${isRTL ? 'font-arabic' : 'font-display'}`}>
                  {authMode === 'login' ? (isRTL ? 'تسجيل الدخول' : 'Login') : (isRTL ? 'إنشاء حساب' : 'Register')}
                </h2>
                <p className="text-natural-muted text-sm uppercase tracking-widest font-bold">Admin Portal</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted px-2">Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-6 py-4 bg-natural-light rounded-2xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted px-2">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-natural-light rounded-2xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none transition-all" 
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-natural-text text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all">
                  {authMode === 'login' ? (isRTL ? 'دخول' : 'Sign In') : (isRTL ? 'تسجيل' : 'Sign Up')}
                </button>
              </form>

              <div className="mt-8 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-natural-border"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-natural-muted tracking-widest"><span className="bg-white px-4">OR</span></div>
                </div>
                <button 
                  onClick={loginWithGoogle}
                  className="w-full py-4 bg-white border border-natural-border text-natural-text rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-natural-light transition-all"
                >
                  <Globe className="w-4 h-4" />
                  Google login
                </button>
                <div className="text-center pt-4">
                   <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="text-[10px] uppercase font-bold text-natural-sage tracking-widest hover:underline"
                  >
                    {authMode === 'login' ? (isRTL ? 'ليس لديك حساب؟ سجل الآن' : "Don't have an account? Register") : (isRTL ? 'لديك حساب بالفعل؟' : "Already have an account? Login")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Edit Modal */}
      <AnimatePresence>
        {isEditingGlobal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingGlobal(false)}
              className="absolute inset-0 bg-natural-text/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-natural-border flex items-center justify-between bg-natural-light/50">
                <h2 className={`text-2xl font-bold ${isRTL ? 'font-arabic' : 'font-display'}`}>
                  {isRTL ? 'تعديل محتوى الموقع' : 'Edit Site Content'}
                </h2>
                <button onClick={() => setIsEditingGlobal(false)} className="p-2 hover:bg-natural-light rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveGlobal} className="p-8 overflow-y-auto space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">Hero Section (Arabic)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Name (use &lt;br/&gt; for line break)</label>
                       <input 
                        value={siteContent?.heroNameAr || ''} 
                        onChange={e => setSiteContent({...siteContent, heroNameAr: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Professional Title</label>
                       <input 
                        value={siteContent?.heroTitleAr || ''} 
                        onChange={e => setSiteContent({...siteContent, heroTitleAr: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">Hero Section (English)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Name</label>
                       <input 
                        value={siteContent?.heroNameEn || ''} 
                        onChange={e => setSiteContent({...siteContent, heroNameEn: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Professional Title</label>
                       <input 
                        value={siteContent?.heroTitleEn || ''} 
                        onChange={e => setSiteContent({...siteContent, heroTitleEn: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">About Section (Arabic)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">About Text</label>
                       <textarea 
                        rows={6}
                        value={siteContent?.aboutTextAr || ''} 
                        onChange={e => setSiteContent({...siteContent, aboutTextAr: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">About Section (English)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">About Text</label>
                       <textarea 
                        rows={6}
                        value={siteContent?.aboutTextEn || ''} 
                        onChange={e => setSiteContent({...siteContent, aboutTextEn: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">Mission / Vision (Arabic)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Vision Text</label>
                       <textarea 
                        rows={4}
                        value={siteContent?.visionTextAr || ''} 
                        onChange={e => setSiteContent({...siteContent, visionTextAr: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-natural-muted border-b border-natural-border pb-2">Mission / Vision (English)</h3>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-natural-muted uppercase px-2">Vision Text</label>
                       <textarea 
                        rows={4}
                        value={siteContent?.visionTextEn || ''} 
                        onChange={e => setSiteContent({...siteContent, visionTextEn: e.target.value})}
                        className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border outline-none focus:ring-2 focus:ring-natural-sage" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-10 sticky bottom-0 bg-white border-t border-natural-border py-4">
                  <button type="submit" className="flex-1 py-4 bg-natural-sage text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />
                    {display.save}
                  </button>
                  <button type="button" onClick={() => setIsEditingGlobal(false)} className="px-8 py-4 bg-natural-light text-natural-muted rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-natural-border transition-all">
                    {display.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-natural-text/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-natural-border flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${isRTL ? 'font-arabic' : 'font-display'}`}>
                  {editingCourse ? display.editCourse : display.addCourse}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-natural-light rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveCourse} className="p-8 overflow-y-auto space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Title (AR)</label>
                    <input required value={formData.titleAr} onChange={(e) => setFormData({...formData, titleAr: e.target.value})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Title (EN)</label>
                    <input required value={formData.titleEn} onChange={(e) => setFormData({...formData, titleEn: e.target.value})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Description (AR)</label>
                  <textarea required rows={3} value={formData.descriptionAr} onChange={(e) => setFormData({...formData, descriptionAr: e.target.value})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Description (EN)</label>
                  <textarea required rows={3} value={formData.descriptionEn} onChange={(e) => setFormData({...formData, descriptionEn: e.target.value})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Price (EGP)</label>
                    <input type="number" required value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Category</label>
                    <input required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Duration</label>
                    <input required value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} placeholder="e.g. 4 Weeks" className="w-full px-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none" />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-natural-muted">Course Cover Image</label>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-48 aspect-video bg-natural-light rounded-2xl border border-natural-border overflow-hidden relative group">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-natural-muted/30">
                          <BookOpen className="w-8 h-8 mb-2" />
                          <span className="text-[8px] font-bold uppercase tracking-widest">No Image</span>
                        </div>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur flex flex-col items-center justify-center p-4">
                          <Loader2 className="w-6 h-6 text-natural-sage animate-spin mb-2" />
                          <div className="w-full h-1.5 bg-natural-light rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              className="h-full bg-natural-sage" 
                            />
                          </div>
                          <span className="text-[8px] font-bold mt-2 text-natural-sage">{Math.round(uploadProgress)}%</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-3 px-6 bg-natural-text text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          {isRTL ? 'تحميل صورة' : 'Upload Image'}
                        </button>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center text-natural-muted/40">
                          <Globe className="w-3 h-3" />
                        </div>
                        <input 
                          placeholder={isRTL ? 'أو ضع رابط مباشرة' : 'Or paste URL directly'}
                          value={formData.imageUrl} 
                          onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} 
                          className="w-full pl-10 pr-4 py-3 bg-natural-light rounded-xl border border-natural-border focus:ring-2 focus:ring-natural-sage outline-none text-xs" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="submit" 
                    disabled={uploading}
                    className="flex-1 py-4 bg-natural-sage text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {display.save}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-natural-light text-natural-muted rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-natural-border transition-all">
                    {display.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Qualifications */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center">
           <h2 className={`text-4xl md:text-5xl font-bold mb-16 text-natural-text ${isRTL ? 'font-arabic' : 'font-display'}`}>
              {isRTL ? 'الشهادات والاعتمادات' : 'Certifications & Accreditations'}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
               {[
                 isRTL ? "مدربة دولية محترفة معتمدة" : "Certified International Professional Trainer",
                 isRTL ? "استشاري تدريب دولي معتمد" : "Certified International Training Consultant",
                 isRTL ? "TOT معتمد" : "Certified TOT Specialist",
                 isRTL ? "خبير إعداد قادة" : "Leadership Development Expert",
                 isRTL ? "إرشاد أسري وصحة نفسية" : "Family Counseling & Mental Health",
               ].map((cert, j) => (
                 <span key={j} className="px-6 py-3 bg-natural-light border border-natural-border rounded-full text-[10px] font-bold uppercase tracking-widest text-natural-muted">
                    {cert}
                 </span>
               ))}
            </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="bg-white pt-24 pb-12 px-6 text-natural-text border-t border-natural-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-16 pb-16 border-b border-natural-border">
            <div className="flex gap-16">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-widest text-natural-muted mb-3 font-bold">Email Address</span>
                <span className="text-sm font-bold">rhabfaceb9@gmail.com</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-widest text-natural-muted mb-3 font-bold">Contact Phone</span>
                <span className="text-sm font-bold tracking-wider" dir="ltr">+20 11 44622275</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] text-natural-muted font-bold uppercase tracking-widest mb-1">Training Manager</p>
                <p className="text-sm font-bold">Rehab Company & CFBL Academy</p>
              </div>
              <div className="w-[1px] h-10 bg-natural-border"></div>
              <div className="flex gap-4">
                <a href="https://www.linkedin.com/in/rehab-ahmed-ali-674387232?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank" rel="noopener noreferrer" className="p-2 text-natural-muted hover:text-natural-sage transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="https://www.facebook.com/share/1FkaGiCwcS/" target="_blank" rel="noopener noreferrer" className="p-2 text-natural-muted hover:text-natural-sage transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="p-2 text-natural-muted hover:text-natural-sage transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-bold text-natural-muted uppercase tracking-widest">
            <p>Portfolio © {new Date().getFullYear()} {isRTL ? 'رحاب أحمد علي ياسين' : 'Rehab Ahmed Ali'}</p>
            <p>{isRTL ? "صناعة أشخاص قادرين على بناء مستقبلهم" : "Empowering People to Build Their Future"}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


