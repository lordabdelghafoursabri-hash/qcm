import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { quizData } from './data';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AppState, AppScreen, Progress, Category, Specialization, Level, Question } from './types';
import { SunIcon, MoonIcon, ArrowLeftIcon, HomeIcon } from './components/icons';
import { LockIcon, CheckCircleIcon, XCircleIcon, ShareIcon, FlagIcon, BookOpenIcon, WhatsAppIcon, ChartBarIcon, LevelsIcon, SparklesIcon } from './components/icons';

const PASS_PERCENTAGE = 0.5; // 50% to pass

// --- Helper functions for nested data structure ---
const findSpecRecursive = (specializations: Specialization[], specId: string): Specialization | undefined => {
    for (const spec of specializations) {
        if (spec.id === specId) return spec;
        if (spec.specializations) {
            const found = findSpecRecursive(spec.specializations, specId);
            if (found) return found;
        }
    }
    return undefined;
};

const findParentSpec = (categories: Category[], childSpecId: string): Specialization | undefined => {
    for (const category of categories) {
        for (const spec of category.specializations) {
            if (spec.specializations) {
                const isParent = spec.specializations.some(subSpec => subSpec.id === childSpecId);
                if (isParent) return spec;
            }
        }
    }
    return undefined;
};


// --- Main App Component ---
export default function App() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
  const [progress, setProgress] = useLocalStorage<Progress>('progress', {});
  const [appState, setAppState] = useState<AppState>({ screen: AppScreen.Home });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const navigate = (newState: Partial<AppState>) => {
    setAppState(prevState => ({ ...prevState, ...newState }));
  };
  
  const handleQuizComplete = useCallback((specializationId: string, levelId: number, score: number, userAnswers: (number | null)[]) => {
      const currentLevelProgress = progress[specializationId]?.[levelId] ?? 0;
      if (score > currentLevelProgress) {
          setProgress({
              ...progress,
              [specializationId]: {
                  ...progress[specializationId],
                  [levelId]: score,
              },
          });
      }
      navigate({ screen: AppScreen.Result, score, userAnswers, reviewMode: false });
  }, [progress, setProgress]);


  const selectedCategory = useMemo(() => quizData.find(c => c.id === appState.categoryId), [appState.categoryId]);
  
  const selectedSpecialization = useMemo(() => {
    if (!selectedCategory || !appState.specializationId) return undefined;
    // We need to search recursively in case of nested specializations
    return findSpecRecursive(selectedCategory.specializations, appState.specializationId);
  }, [selectedCategory, appState.specializationId]);

  const selectedLevel = useMemo(() => selectedSpecialization?.levels.find(l => l.id === appState.levelId), [selectedSpecialization, appState.levelId]);
  
  const handleStartNextLevel = useCallback(() => {
    if (!selectedSpecialization || !appState.levelId) return;
    
    const currentLevelIndex = selectedSpecialization.levels.findIndex(l => l.id === appState.levelId);
    const nextLevel = selectedSpecialization.levels[currentLevelIndex + 1];

    if (nextLevel && nextLevel.questions.length > 0) {
      navigate({
        screen: AppScreen.Quiz,
        levelId: nextLevel.id,
        reviewMode: false,
        userAnswers: [],
        score: undefined,
      });
    }
  }, [selectedSpecialization, appState.levelId]);


  const renderScreen = () => {
    switch (appState.screen) {
      case AppScreen.Specializations: {
          const handleSelectSpecialization = (specId: string) => {
            const spec = selectedCategory?.specializations.find(s => s.id === specId);
            if (spec?.specializations && spec.specializations.length > 0) {
              navigate({ screen: AppScreen.SubSpecializations, specializationId: specId });
            } else {
              navigate({ screen: AppScreen.Levels, specializationId: specId });
            }
          };
          return <SpecializationScreen category={selectedCategory!} onSelect={handleSelectSpecialization} />;
      }
      case AppScreen.SubSpecializations: {
        const subCategoryAsCategory: Category = {
            id: selectedSpecialization!.id,
            name: selectedSpecialization!.name,
            specializations: selectedSpecialization!.specializations!
        };
        return <SpecializationScreen category={subCategoryAsCategory} onSelect={specId => navigate({ screen: AppScreen.Levels, specializationId: specId })} />;
      }
      case AppScreen.Levels:
        return <LevelScreen specialization={selectedSpecialization!} progress={progress[selectedSpecialization!.id] || {}} onSelect={levelId => navigate({ screen: AppScreen.Quiz, levelId: levelId, reviewMode: false, userAnswers: [] })} />;
      case AppScreen.Quiz:
        return <QuizScreen level={selectedLevel!} onComplete={(score, answers) => handleQuizComplete(selectedSpecialization!.id, selectedLevel!.id, score, answers)} reviewMode={appState.reviewMode || false} userAnswers={appState.userAnswers || []} />;
      case AppScreen.Result: {
        const currentLevelIndex = selectedSpecialization!.levels.findIndex(l => l.id === appState.levelId);
        const nextLevel = selectedSpecialization!.levels[currentLevelIndex + 1];
        const isNextLevelAvailable = !!nextLevel && nextLevel.questions.length > 0;

        return <ResultScreen 
                  score={appState.score!} 
                  totalQuestions={selectedLevel!.questions.length} 
                  onRetry={() => navigate({ screen: AppScreen.Quiz, reviewMode: false, userAnswers: [] })} 
                  onReview={() => navigate({ screen: AppScreen.Quiz, reviewMode: true })}
                  onNextLevel={handleStartNextLevel}
                  isNextLevelAvailable={isNextLevelAvailable}
                />;
      }
      case AppScreen.Stats:
        return <StatsScreen progress={progress} />;
      case AppScreen.Home:
      default:
        return <HomeScreen onSelect={catId => navigate({ screen: AppScreen.Specializations, categoryId: catId })} />;
    }
  };

  const getHeaderTitle = () => {
    switch (appState.screen) {
        case AppScreen.Home: return "QCM Taalim";
        case AppScreen.Specializations: return selectedCategory?.name || "اختر التخصص";
        case AppScreen.SubSpecializations: return selectedSpecialization?.name || "اختر التخصص";
        case AppScreen.Levels: return selectedSpecialization?.name || "اختر المستوى";
        case AppScreen.Quiz: return `المستوى ${selectedLevel?.levelNumber}`;
        case AppScreen.Result: return "النتيجة";
        case AppScreen.Stats: return "إحصاءاتي";
        default: return "QCM Taalim";
    }
  };

  const canGoBack = appState.screen !== AppScreen.Home;
  const goBack = () => {
    switch (appState.screen) {
        case AppScreen.Specializations: navigate({ screen: AppScreen.Home, categoryId: undefined, specializationId: undefined }); break;
        case AppScreen.SubSpecializations: navigate({ screen: AppScreen.Specializations, specializationId: undefined }); break;
        case AppScreen.Levels: {
            const parent = findParentSpec(quizData, appState.specializationId!);
            if (parent) {
                navigate({ screen: AppScreen.SubSpecializations, specializationId: parent.id, levelId: undefined });
            } else {
                navigate({ screen: AppScreen.Specializations, specializationId: undefined, levelId: undefined });
            }
            break;
        }
        case AppScreen.Quiz: navigate({ screen: AppScreen.Levels, levelId: undefined }); break;
        case AppScreen.Result: navigate({ screen: AppScreen.Levels, score: undefined, userAnswers: undefined }); break;
        case AppScreen.Stats: navigate({ screen: AppScreen.Home }); break;
    }
  };


  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-10">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-4">
                  {canGoBack ? (
                      <button onClick={goBack} aria-label="العودة" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                          <ArrowLeftIcon />
                      </button>
                  ) : (
                    <button onClick={() => navigate({screen: AppScreen.Stats})} aria-label="الإحصاءات" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                      <ChartBarIcon className="w-6 h-6" />
                    </button>
                  )}
                  <h1 className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">{getHeaderTitle()}</h1>
              </div>
              <div className="flex items-center gap-2">
                {appState.screen !== AppScreen.Home && (
                   <button onClick={() => navigate({ screen: AppScreen.Home, categoryId: undefined, specializationId: undefined, levelId: undefined })} aria-label="الرئيسية" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                      <HomeIcon />
                  </button>
                )}
                <button onClick={toggleTheme} aria-label="تغيير المظهر" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
              </div>
          </nav>
      </header>
      <main className="container mx-auto p-4 sm:p-6">
        {renderScreen()}
      </main>
    </div>
  );
}


// --- Screen Components ---

const FeatureCard: React.FC<{icon: React.ReactNode, title: string, description: string}> = ({icon, title, description}) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md text-center transform hover:-translate-y-1 transition-transform duration-300">
        <div className="flex justify-center items-center mb-4 h-12">
            {icon}
        </div>
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{description}</p>
    </div>
);


const HomeScreen: React.FC<{ onSelect: (categoryId: string) => void }> = ({ onSelect }) => {
    const handleShareApp = () => {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                text: 'QCM Taalim: تطبيق رائع للتحضير لامتحانات وظائف التعليم في المغرب!',
                url: window.location.href,
            }).catch(console.error);
        } else {
            alert('خاصية المشاركة غير مدعومة في هذا المتصفح.');
        }
    };

    return (
        <div className="animate-fade-in space-y-12">
            {/* Hero Section */}
            <div className="text-center pt-8 pb-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 dark:from-teal-700 dark:to-cyan-800 text-white shadow-lg">
                <BookOpenIcon className="w-24 h-24 mx-auto drop-shadow-lg" />
                <h1 className="text-4xl sm:text-5xl font-bold mt-4 drop-shadow-md">QCM Taalim</h1>
                <p className="text-lg opacity-90 mt-2 max-w-2xl mx-auto px-4">
                    امتحانات وظائف التعليم - دليلك الشامل للاستعداد والنجاح في مباريات التعليم بالمغرب
                </p>
            </div>

            {/* Main Call to Action */}
            <div>
                <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 dark:text-slate-100">اختر مسارك</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {quizData.map(category => (
                        <button key={category.id} onClick={() => onSelect(category.id)} className="group bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transform transition-all duration-300">
                            <h2 className="text-2xl font-bold text-teal-600 dark:text-teal-400 group-hover:text-teal-500 dark:group-hover:text-teal-300 transition-colors">{category.name}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">ابدأ الاستعداد الآن</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Features Section */}
            <div className="pt-8">
                <h2 className="text-2xl font-bold mb-8 text-center text-slate-800 dark:text-slate-100">لماذا تختار تطبيقنا؟</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    <FeatureCard 
                        icon={<BookOpenIcon className="w-10 h-10 text-teal-500" />}
                        title="بنك أسئلة شامل"
                        description="محتوى متجدد يغطي كافة التخصصات والمستويات."
                    />
                    <FeatureCard 
                        icon={<LevelsIcon className="w-10 h-10 text-teal-500" />}
                        title="مستويات متدرجة"
                        description="تحدى نفسك مع مستويات متزايدة الصعوبة لتقييم تطورك."
                    />
                    <FeatureCard 
                        icon={<ChartBarIcon className="w-10 h-10 text-teal-500" />}
                        title="تتبع الأداء"
                        description="إحصاءات دقيقة لمراقبة تقدمك وتحديد نقاط القوة والضعف."
                    />
                     <FeatureCard 
                        icon={<SparklesIcon className="w-10 h-10 text-teal-500" />}
                        title="تجربة استخدام مريحة"
                        description="واجهة بسيطة وواضحة مع دعم كامل للوضع الليلي."
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 border-t dark:border-slate-700 pt-8 mt-8">
                <button onClick={handleShareApp} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                    <ShareIcon />
                    <span>مشاركة التطبيق</span>
                </button>
                <a href="https://wa.me/212652624294" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                    <WhatsAppIcon />
                    <span>تواصل معنا</span>
                </a>
            </div>
        </div>
    );
};


const SpecializationScreen: React.FC<{ category: Category; onSelect: (specializationId: string) => void }> = ({ category, onSelect }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 animate-fade-in">
        {category.specializations.map(spec => (
            <div key={spec.id} onClick={() => onSelect(spec.id)} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-5 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200">
                <h3 className="text-lg font-semibold">{spec.name}</h3>
                {spec.levels.every(l => l.questions.length === 0) && (!spec.specializations || spec.specializations.length === 0) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">سيتم إضافة الأسئلة قريباً</p>
                )}
            </div>
        ))}
    </div>
);

const LevelScreen: React.FC<{ specialization: Specialization; progress: { [key: number]: number }; onSelect: (levelId: number) => void }> = ({ specialization, progress, onSelect }) => {
    let lastUnlockedLevel = 1;
    for (let i = 1; i <= specialization.levels.length; i++) {
        const level = specialization.levels[i-1];
        if (level && level.questions.length > 0) {
            const score = progress[level.id] || 0;
            if(score >= level.questions.length * PASS_PERCENTAGE) {
                lastUnlockedLevel = i + 1;
            } else {
                break;
            }
        } else if (level && level.questions.length === 0 && lastUnlockedLevel === i) {
            break;
        }
    }
    
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4 animate-fade-in">
            {specialization.levels.map((level) => {
                const isLocked = level.levelNumber > lastUnlockedLevel;
                const bestScore = progress[level.id];
                const isAvailable = level.questions.length > 0;
                const isCompleted = bestScore !== undefined;

                return (
                    <button 
                        key={level.id} 
                        onClick={() => !isLocked && isAvailable && onSelect(level.id)} 
                        disabled={isLocked || !isAvailable}
                        className={`aspect-square flex flex-col justify-center items-center rounded-lg shadow-md transition-all duration-200 text-white
                            ${isLocked || !isAvailable ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 cursor-pointer'}
                        `}
                    >
                        <span className="text-2xl font-bold">{level.levelNumber}</span>
                        <div className="text-xs h-8 flex items-center text-center px-1">
                          {isLocked ? <LockIcon /> : (isAvailable ? (isCompleted ? `أفضل: ${bestScore}/${level.questions.length}` : 'ابدأ') : 'قريباً')}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const QuizScreen: React.FC<{ level: Level; onComplete: (score: number, userAnswers: (number | null)[]) => void; reviewMode: boolean, userAnswers: (number | null)[] }> = ({ level, onComplete, reviewMode, userAnswers: initialUserAnswers }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<(number | null)[]>(reviewMode ? initialUserAnswers : Array(level.questions.length).fill(null));
    const [selectedOption, setSelectedOption] = useState<number|null>(userAnswers[0]);

    const question = level.questions[currentQuestionIndex];

    const handleOptionSelect = (optionIndex: number) => {
      if (userAnswers[currentQuestionIndex] !== null) return; // Prevent changing answer
      setSelectedOption(optionIndex);
      const newAnswers = [...userAnswers];
      newAnswers[currentQuestionIndex] = optionIndex;
      setUserAnswers(newAnswers);
    };

    const handleNext = () => {
      if (currentQuestionIndex < level.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(userAnswers[currentQuestionIndex + 1]);
      } else {
        const score = userAnswers.reduce((total, answer, index) => {
            return answer === level.questions[index].correctAnswerIndex ? total + 1 : total;
        }, 0);
        onComplete(score, userAnswers);
      }
    };
    
    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
            setSelectedOption(userAnswers[currentQuestionIndex - 1]);
        }
    };
    
    const handleReportError = () => {
        const text = encodeURIComponent(`مرحباً،\nأود التبليغ عن خطأ محتمل في السؤال التالي:\n\nالمستوى: ${level.levelNumber}\nرقم السؤال: ${question.id}\nنص السؤال: "${question.text}"\n\nالرجاء المراجعة وشكراً.`);
        const whatsappUrl = `https://wa.me/212652624294?text=${text}`;
        window.open(whatsappUrl, '_blank');
    };

    const progressPercentage = ((currentQuestionIndex + 1) / level.questions.length) * 100;
    const answered = userAnswers[currentQuestionIndex] !== null;

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                سؤال {currentQuestionIndex + 1} من {level.questions.length}
            </p>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md flex-grow">
                <h2 className="text-lg sm:text-xl font-semibold mb-6 leading-relaxed">{question.text}</h2>
                <div className="space-y-3">
                    {question.options.map((option, index) => {
                        const isCorrect = index === question.correctAnswerIndex;
                        const isSelected = selectedOption === index;
                        let optionClass = 'border-slate-300 dark:border-slate-600 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-slate-700';
                        if (reviewMode || answered) {
                            if (isCorrect) {
                                optionClass = 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-700';
                            } else if (isSelected) {
                                optionClass = 'bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-700';
                            }
                        } else if (isSelected) {
                             optionClass = 'border-teal-500 bg-teal-50 dark:bg-slate-700 ring-2 ring-teal-500';
                        }
                        
                        return (
                            <button 
                                key={index} 
                                onClick={() => !reviewMode && handleOptionSelect(index)}
                                disabled={reviewMode || answered}
                                className={`w-full text-right p-4 border-2 rounded-lg transition-all duration-200 flex justify-between items-center text-sm sm:text-base ${optionClass}`}
                            >
                                <span>{option}</span>
                                {(reviewMode || answered) && isCorrect && <CheckCircleIcon />}
                                {(reviewMode || answered) && !isCorrect && isSelected && <XCircleIcon />}
                            </button>
                        );
                    })}
                </div>
                 <div className="flex justify-center mt-6 pt-4 border-t dark:border-slate-700">
                    <button onClick={handleReportError} className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <FlagIcon />
                        <span>تبليغ عن خطأ</span>
                    </button>
                </div>
            </div>
            <div className="mt-6 flex justify-between items-center">
                <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-md disabled:opacity-50">
                    السابق
                </button>
                <button onClick={handleNext} disabled={!answered && !reviewMode} className="px-8 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
                    {currentQuestionIndex === level.questions.length - 1 ? (reviewMode ? 'إنهاء المراجعة' : 'إنهاء الاختبار') : 'التالي'}
                </button>
            </div>
        </div>
    );
};


const ResultScreen: React.FC<{ score: number; totalQuestions: number; onRetry: () => void; onReview: () => void; onNextLevel: () => void; isNextLevelAvailable: boolean; }> = ({ score, totalQuestions, onRetry, onReview, onNextLevel, isNextLevelAvailable }) => {
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passed = percentage >= (PASS_PERCENTAGE * 100);

    const shareResult = () => {
        const text = `لقد حصلت على ${score} من ${totalQuestions} (${percentage}%) في اختبار وظائف التعليم!`;
        if (navigator.share) {
            navigator.share({
                title: 'نتيجة الاختبار',
                text: text,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(text).then(() => alert('تم نسخ النتيجة إلى الحافظة!'));
        }
    };

    return (
        <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl animate-fade-in-up">
            <h2 className="text-3xl font-bold mb-2">{passed ? '🎉 لقد نجحت! 🎉' : '😕 حاول مرة أخرى'}</h2>
            <p className={`text-lg mb-6 ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {passed ? 'أداء رائع، يمكنك الانتقال للمستوى التالي.' : 'لا بأس، يمكنك المحاولة مجدداً.'}
            </p>
            <div className="my-8">
                <div className={`text-6xl font-bold ${passed ? 'text-green-500' : 'text-red-500'}`}>{percentage}%</div>
                <div className="text-slate-600 dark:text-slate-400 mt-2">
                    إجابات صحيحة: {score} / {totalQuestions}
                </div>
            </div>
             <div className="mt-8 flex w-full max-w-md mx-auto flex-col items-center gap-4">
                <div className="flex w-full gap-4">
                    <button
                        onClick={onRetry}
                        className="flex-1 rounded-md bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                        إعادة المستوى
                    </button>
                    <button
                        onClick={onReview}
                        className="flex-1 rounded-md bg-slate-200 px-6 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        مراجعة الإجابات
                    </button>
                </div>
                {isNextLevelAvailable && (
                    <button
                        onClick={onNextLevel}
                        disabled={!passed}
                        className="w-full rounded-md bg-green-600 px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                        المستوى التالي
                    </button>
                )}
                <button
                    onClick={shareResult}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white shadow-md transition-colors hover:bg-blue-600"
                >
                    <ShareIcon />
                    <span>مشاركة النتيجة</span>
                </button>
            </div>
        </div>
    );
};

const StatsScreen: React.FC<{ progress: Progress }> = ({ progress }) => {
    const totalLevels = quizData.flatMap(c => c.specializations.flatMap(s => s.levels.filter(l => l.questions.length > 0))).length;
    const completedLevels = Object.values(progress).flatMap(s => Object.keys(s)).length;
    
    let totalScore = 0;
    let totalQuestions = 0;

    for (const specId in progress) {
        const specData = quizData.flatMap(c => c.specializations).find(s => s.id === specId);
        if (specData) {
            for (const levelId in progress[specId]) {
                const levelData = specData.levels.find(l => l.id === parseInt(levelId));
                if (levelData) {
                    totalScore += progress[specId][levelId];
                    totalQuestions += levelData.questions.length;
                }
            }
        }
    }

    const averagePercentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-2xl font-bold mb-6 text-teal-600 dark:text-teal-400">إحصاءات الأداء</h2>
            {completedLevels === 0 ? (
                <p>لم تكمل أي مستوى بعد. ابدأ اختباراً لعرض إحصاءاتك هنا!</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-teal-500">{completedLevels}</p>
                        <p className="text-slate-600 dark:text-slate-400">مستوى مكتمل</p>
                    </div>
                     <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-teal-500">{totalLevels}</p>
                        <p className="text-slate-600 dark:text-slate-400">إجمالي المستويات</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-teal-500">{averagePercentage}%</p>
                        <p className="text-slate-600 dark:text-slate-400">متوسط الدقة</p>
                    </div>
                </div>
            )}
        </div>
    );
};
