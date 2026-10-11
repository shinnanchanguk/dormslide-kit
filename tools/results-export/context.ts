import { createContext, useContext } from "react";
import { createLocalResults } from "./roomResults";

export const LocalResultsContext = createContext(createLocalResults());
export const useLocalResults = () => useContext(LocalResultsContext);
