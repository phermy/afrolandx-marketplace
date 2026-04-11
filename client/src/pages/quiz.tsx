import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Star,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  questions: Question[];
  rewardPoints: number;
}

interface QuizResult {
  attempt: any;
  score: number;
  passed: boolean;
  pointsEarned: number;
  correctCount: number;
  totalQuestions: number;
}

export default function QuizPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, params] = useRoute("/quizzes/:id");
  const quizId = params?.id ? parseInt(params.id) : null;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quiz, isLoading } = useQuery<Quiz>({
    queryKey: ["/api/quizzes", quizId],
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/${quizId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Quiz not found");
      return res.json();
    },
    enabled: !!quizId && !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async (answers: number[]) => {
      const response = await apiRequest("POST", `/api/quizzes/${quizId}/submit`, { answers });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setShowResult(true);
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < (quiz?.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    if (answers.length === quiz?.questions?.length) {
      submitMutation.mutate(answers);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in to take quizzes</h1>
        <p className="text-muted-foreground mb-4">
          Learn about African cultural heritage and earn loyalty points!
        </p>
        <Button asChild>
          <a href="/api/login">Sign In</a>
        </Button>
      </div>
    );
  }

  if (!quizId) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p>Quiz not found. <Link href="/loyalty" className="text-primary underline">Go back to Loyalty page</Link></p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p>Quiz not found. <Link href="/loyalty" className="text-primary underline">Go back to Loyalty page</Link></p>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];
  const allAnswered = answers.filter(a => a !== undefined).length === questions.length;

  if (showResult && result) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className={result.passed ? "border-green-500" : "border-orange-500"}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {result.passed ? (
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <Trophy className="h-10 w-10 text-green-600" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
                    <XCircle className="h-10 w-10 text-orange-600" />
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl">
                {result.passed ? "Congratulations!" : "Keep Learning!"}
              </CardTitle>
              <CardDescription>
                {result.passed 
                  ? "You've demonstrated great knowledge of African culture!" 
                  : "Don't worry, you can try again and learn more."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="text-5xl font-bold text-primary">
                {result.score}%
              </div>
              
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-green-600">{result.correctCount}</div>
                  <div className="text-sm text-muted-foreground">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-red-600">
                    {result.totalQuestions - result.correctCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Incorrect</div>
                </div>
              </div>

              {result.pointsEarned > 0 && (
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                    <span className="text-xl font-semibold">+{result.pointsEarned} Points Earned!</span>
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-3">
                <h4 className="font-medium text-left">Review Answers:</h4>
                {questions.map((q, index) => {
                  const userAnswer = answers[index];
                  const isCorrect = userAnswer === q.correctIndex;
                  return (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg text-left ${isCorrect ? "bg-green-50" : "bg-red-50"}`}
                    >
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{q.question}</p>
                          {!isCorrect && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Correct answer: {q.options[q.correctIndex]}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" asChild className="flex-1">
                <Link href="/loyalty">Back to Loyalty</Link>
              </Button>
              {!result.passed && (
                <Button 
                  className="flex-1"
                  onClick={() => {
                    setAnswers([]);
                    setCurrentQuestion(0);
                    setShowResult(false);
                    setResult(null);
                  }}
                >
                  Try Again
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {quiz.title}
            </h1>
            <Badge variant="outline">
              <Star className="h-3 w-3 mr-1" />
              +{quiz.rewardPoints} pts
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{quiz.description}</p>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {currentQ?.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={answers[currentQuestion]?.toString()}
              onValueChange={(value) => handleAnswer(parseInt(value))}
            >
              {currentQ?.options.map((option, index) => (
                <div 
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer
                    ${answers[currentQuestion] === index ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                  onClick={() => handleAnswer(index)}
                  data-testid={`option-${index}`}
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentQuestion === 0}
              data-testid="button-prev"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex gap-1">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors
                    ${currentQuestion === index 
                      ? "bg-primary text-primary-foreground" 
                      : answers[index] !== undefined 
                        ? "bg-green-100 text-green-700" 
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  data-testid={`question-dot-${index}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {currentQuestion < questions.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={answers[currentQuestion] === undefined}
                data-testid="button-next"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || submitMutation.isPending}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Submit Quiz
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
