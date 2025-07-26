# Grade Projection Feature Specification

## 1. Feature Overview

### 1.1 Vision Statement
An intelligent grade calculation and projection system that leverages syllabus-extracted grading weights to help students visualize their academic performance in real-time and enables universities to identify at-risk students early for targeted intervention.

### 1.2 Core Value Propositions

#### For Students
- Real-time grade calculation based on actual syllabus weights
- "What-if" scenarios for planning study efforts
- Minimum grade calculator for achieving target grades
- Visual progress tracking throughout the semester

#### For Universities (Monetization Path)
- Early identification of at-risk students (within first 4-6 weeks)
- Automated intervention recommendations
- Integration with existing academic support resources
- Measurable improvement in retention rates

## 2. Technical Architecture

### 2.1 Data Model Extensions

#### Grading Weights (Course Model Extension)
```json
{
  "grading_weights": {
    "assignments": 30,
    "quizzes": 20,
    "midterm": 20,
    "final": 25,
    "participation": 5
  },
  "grading_scale": {
    "A": {"min": 93, "max": 100},
    "A-": {"min": 90, "max": 92.99},
    "B+": {"min": 87, "max": 89.99},
    "B": {"min": 83, "max": 86.99},
    "B-": {"min": 80, "max": 82.99},
    "C+": {"min": 77, "max": 79.99},
    "C": {"min": 73, "max": 76.99},
    "C-": {"min": 70, "max": 72.99},
    "D": {"min": 60, "max": 69.99},
    "F": {"min": 0, "max": 59.99}
  }
}
```

#### Grade Entry Model
```python
class GradeEntry(Base):
    id = Column(UUID, primary_key=True)
    student_id = Column(UUID, ForeignKey('users.id'))
    course_id = Column(UUID, ForeignKey('courses.id'))
    event_id = Column(UUID, ForeignKey('course_events.id'))
    category = Column(String)  # assignments, quizzes, midterm, etc
    points_earned = Column(Float, nullable=True)
    points_possible = Column(Float)
    is_projected = Column(Boolean, default=False)
    entry_method = Column(Enum('manual', 'email', 'lms_api'))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### 2.2 API Endpoints

#### Grade Management
```
GET /api/grades/course/{course_id}
  - Fetch all grades for a course
  - Include actual and projected grades
  - Calculate current and projected final grade

POST /api/grades/entry
  - Create/update grade entry
  - Support manual and projected entries

PUT /api/grades/entry/{entry_id}
  - Update existing grade
  - Toggle between actual/projected

GET /api/grades/projection/{course_id}
  - Calculate grade projections
  - Include minimum grades needed
  - Support target grade parameter
```

#### Risk Analytics (Phase 2)
```
GET /api/analytics/at-risk-students
  - Identify students below grade thresholds
  - Include trend analysis
  - Return intervention recommendations

GET /api/analytics/course/{course_id}/risk-report
  - Course-specific risk analysis
  - Performance distribution
  - Early warning indicators
```

## 3. User Interface Components

### 3.1 Grade Dashboard

#### Current Grade Display
- Large circular progress indicator showing current grade
- Letter grade with percentage
- Trend indicator (up/down arrow)
- Color coding based on performance

#### Grade Breakdown Table
```
| Category      | Weight | Earned/Total | Grade  | Impact |
|---------------|--------|--------------|--------|--------|
| Assignments   | 30%    | 180/200      | 90%    | 27%    |
| Quizzes       | 20%    | 85/100       | 85%    | 17%    |
| Midterm       | 20%    | --/100       | --     | --     |
| Final         | 25%    | --/100       | --     | --     |
| Participation | 5%     | 5/5          | 100%   | 5%     |
```

### 3.2 Grade Projection Interface

#### Projection Controls
- **Mode Toggle**: Switch between "Actual" and "Projection" modes
- **Target Grade Selector**: Dropdown to select desired final grade
- **Performance Ratio Slider**: 
  - "I typically perform X% better on [category] than [category]"
  - Intuitive drag interface to adjust expected performance

#### What-If Scenarios
- Input fields for hypothetical grades on upcoming assignments
- Real-time final grade calculation
- Visual indicator showing distance to target grade
- "Best case" / "Worst case" scenario buttons

#### Minimum Grade Calculator
- Select target final grade (A, B, C, etc.)
- Display minimum required grades for each remaining assignment
- Highlight which requirements are realistic vs challenging
- Alternative paths to achieve target (e.g., "drop lowest quiz")

### 3.3 Grade Collection Methods

#### Phase 1: Manual Entry with Smart Reminders
- Email notifications 1 week after assignment due dates
- Interactive email forms using Gmail AMP (if available)
- Quick entry links that pre-populate assignment info
- Mobile-optimized entry forms

#### Future: LMS Integration
- Canvas API integration
- Blackboard REST API
- Moodle Web Services
- Automatic grade synchronization

## 4. Early Intervention System

### 4.1 Risk Detection Algorithm

#### Key Indicators
- Grade trajectory (declining performance)
- Missing assignments (completion rate)
- Performance vs class average
- Historical patterns from similar students
- Engagement metrics (calendar views, grade checks)

#### Risk Levels
1. **Green**: On track for target grade
2. **Yellow**: Minor concerns, monitor closely
3. **Orange**: Intervention recommended
4. **Red**: Immediate intervention required

### 4.2 Automated Interventions

#### Student Notifications
```
Subject: Let's get back on track in CS 101!

Hi [Student Name],

We noticed you might benefit from some extra support in CS 101. 
Your current grade is 68% (D+), but there's still time to improve!

Recommended Resources:
- CS 101 Tutoring: Tuesdays & Thursdays, 3-5 PM
- Study Group: Wednesdays, 6 PM in Library Room 203
- Office Hours: MWF 2-3 PM

[Schedule Tutoring] [View Grade Details] [Dismiss]
```

#### Administrative Dashboard
- Real-time risk metrics by course/department
- Intervention success tracking
- Export functionality for advisors
- Configurable alert thresholds

## 5. Implementation Phases

### Phase 1: Core Grade Projection
1. Extend course model with grading weights/scale
2. Build grade entry data model and API
3. Create grade dashboard UI
4. Implement projection calculator
5. Add manual grade entry with email reminders

### Phase 2: Risk Detection & Intervention
1. Develop risk detection algorithm
2. Create administrative dashboard
3. Build automated notification system
4. Integrate with campus resources
5. Add analytics and reporting

### Phase 3: Advanced Features
1. LMS API integrations
2. Machine learning risk prediction
3. Peer performance comparisons
4. Grade goal gamification
5. Mobile app with push notifications

## 6. Success Metrics

### Student Engagement
- % of students using grade projection weekly
- Average number of projections per student
- Grade entry completion rate
- Feature satisfaction scores

### Academic Outcomes
- Improvement in course completion rates
- Reduction in failing grades
- Earlier intervention timing
- Resource utilization rates

### University Value
- Number of at-risk students identified
- Intervention success rate
- Retention rate improvement
- ROI on academic support resources

## 7. Security & Privacy Considerations

### Data Protection
- Encrypt grade data at rest and in transit
- Role-based access control
- Audit logging for grade modifications
- FERPA compliance for student records

### Privacy Features
- Opt-in for early intervention notifications
- Configurable data sharing preferences
- Anonymous class performance comparisons
- Secure grade entry authentication

## 8. Integration Points

### Existing SyllabAI Features
- Calendar Integration: Link grades to assignment events
- Course Management: Inherit grading structure
- Notification System: Leverage existing email infrastructure
- User Authentication: Use current auth system

### External Systems
- LMS APIs: Canvas, Blackboard, Moodle
- Student Information Systems
- Academic Advising Platforms
- Campus Tutoring Schedulers

## 9. Competitive Advantages

### For Students
- Automatic syllabus weight extraction (unique to SyllabAI)
- Integrated with existing course calendar
- Proactive grade projections
- Personalized intervention recommendations

### For Universities
- Early warning system (4-6 week identification)
- Automated resource matching
- Measurable retention improvement
- Seamless integration with existing tools