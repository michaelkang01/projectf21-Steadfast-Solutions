import React, { useState } from "react";
import "tailwindcss/tailwind.css";

import CloseButton from "react-bootstrap/CloseButton";
import "bootstrap/dist/css/bootstrap.min.css";
import Section from "./section";

const Skills = () => {
  const [skills_list, set_skill_list] = useState([]);
  const [display_insert, set_display_insert] = useState(false);

  const add_skill = (event) => {
    event.preventDefault();
    const new_skill = event.target.skill.value;
    const new_list = skills_list.concat(new_skill);
    set_skill_list(new_list);
    event.target.reset();
  };

  const delete_skill = (remove_skill) => {
    const new_list = skills_list.filter((skill) => skill !== remove_skill);
    set_skill_list(new_list);
  };

  const skills = (
    <div className="flex flex-row w-full flex-wrap ">
      {skills_list.map((skill) => (
        <div
          className="flex items-center bg-gray-300 mx-4 mb-4 p-2"
          key={skill}
        >
          <CloseButton onClick={() => delete_skill(skill)} />
          <p className="my-0 mx-2">{skill}</p>
        </div>
      ))}
      {display_insert && (
        <div className="flex items-center bg-gray-300 mx-4 p-2">
          <CloseButton />
          <form onSubmit={add_skill}>
            <input
              type="text"
              name="skill"
              placeholder="Enter in a new skill"
            />
            <input type="submit" value="Enter" />
          </form>
        </div>
      )}
    </div>
  );

  return (
    <div
      onMouseOver={() => set_display_insert(true)}
      onMouseLeave={() => set_display_insert(false)}
    >
      <Section name="Skills" content={skills} />
    </div>
  );
};

export default Skills;
