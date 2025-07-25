interface TechLogo {
  src: string;
  alt: string;
}

export const INTEREST_CATEGORIES = [
  "Backend",
  "Database",
  "Network",
  "Java",
  "Spring",
  "DevOps",
  "Frontend",
  "AI/ML"
] as const;

export const logos: TechLogo[] = [
  { src: "/tech-icons/java.svg", alt: "Java" },
  { src: "/tech-icons/kotlin.svg", alt: "Kotlin" },
  { src: "/tech-icons/go.svg", alt: "Go" },
  { src: "/tech-icons/python.svg", alt: "Python" },
  { src: "/tech-icons/typescript.svg", alt: "Typescript" },
  { src: "/tech-icons/spring.svg", alt: "Spring" },
  { src: "/tech-icons/react.svg", alt: "React" },
  { src: "/tech-icons/nextjs.svg", alt: "NextJS" },
  { src: "/tech-icons/mysql.svg", alt: "Mysql" },
  { src: "/tech-icons/postgresql.svg", alt: "PostgreSQL" },
  { src: "/tech-icons/redis.svg", alt: "Redis" },
  { src: "/tech-icons/elasticsearch.svg", alt: "Elasticsearch" },
  { src: "/tech-icons/mongodb.svg", alt: "MongoDB" },
  { src: "/tech-icons/prometheus.svg", alt: "Prometheus" },
  { src: "/tech-icons/docker.svg", alt: "Docker" },
  { src: "/tech-icons/kubernetes.svg", alt: "Kubernetes" }
];
