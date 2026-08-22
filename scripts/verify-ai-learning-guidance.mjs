import { analyzeThesisStatement, generateLessonWritingGuide, generateTopicWizardGuide } from "../server/db.ts";

const guide = await generateTopicWizardGuide({
  step: 3,
  courseType: "middle_high",
  category: "기술 발전",
  topic: "학교에서 생성형 AI를 활용하는 기준",
  mainIdea: "학교는 학습 목적과 개인정보 보호 기준을 갖춘 경우에만 생성형 AI 사용을 허용해야 한다.",
});
const analysis = await analyzeThesisStatement({
  courseType: "middle_high",
  topic: "학교에서 생성형 AI를 활용하는 기준",
  thesis: "학교는 학습 목적과 개인정보 보호 기준을 갖춘 경우에만 생성형 AI 사용을 허용해야 한다.",
});
const lessonGuide = await generateLessonWritingGuide({
  courseType: "middle_high",
  lessonTitle: "주장과 근거",
  lessonContent: "논술은 주장과 이를 뒷받침하는 근거로 이루어집니다.",
  lessonExample: "주장: 학교는 학생의 스마트폰 사용 시간을 제한해야 한다. 근거: 집중력 저하, 수면 방해",
});

console.log(JSON.stringify({ guide, analysis, lessonGuide }, null, 2));
