import { useEffect, useState } from "react";

/**
 * 발표자 따라오기를 한 화면에서 보여 주는 시연(도구 상점 미리보기용). 실제 기능은 실시간 모드의 presenter-follow 다.
 * 왼쪽(선생님)이 넘어가면 잠시 뒤 오른쪽(학생 휴대폰)도 같은 장으로 넘어간다.
 */
const PAGES = ["여는 질문", "오늘의 개념", "함께 생각하기", "정리"];

export function FollowDemo() {
  const [teacher, setTeacher] = useState(0);
  const [student, setStudent] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTeacher((value) => (value + 1) % PAGES.length), 2200);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setStudent(teacher), 450);
    return () => window.clearTimeout(timer);
  }, [teacher]);
  return (
    <div className="ds-follow">
      <figure className="ds-follow__screen ds-follow__screen--teacher">
        <figcaption>선생님 화면</figcaption>
        <div className="ds-follow__slide" key={`t${teacher}`}>
          <span>{String(teacher + 1).padStart(2, "0")}</span>
          <strong>{PAGES[teacher]}</strong>
        </div>
      </figure>
      <div className="ds-follow__arrow" aria-hidden="true" />
      <figure className="ds-follow__screen ds-follow__screen--phone">
        <figcaption>학생 휴대폰</figcaption>
        <div className="ds-follow__slide" key={`s${student}`}>
          <span>{String(student + 1).padStart(2, "0")}</span>
          <strong>{PAGES[student]}</strong>
        </div>
      </figure>
    </div>
  );
}
