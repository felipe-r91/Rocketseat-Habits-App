import dayjs from 'dayjs'
import { FastifyInstance} from 'fastify'
import { z } from 'zod'
import { prisma } from './prisma'

export async function appRoutes(app: FastifyInstance){
// Create an habit by HTTP method POST  
  app.post('/habits', async (request) => {
    // Using zod lib crate an habit body with params title and weekDays
    const createHabitBody = z.object({
      title : z.string(),
      weekDays: z.array(
        z.number().min(0).max(6)
      )
    })

    // Parse params with the body of request
    const { title, weekDays } = createHabitBody.parse(request.body)

    //Create a const with the actual date
    const today = dayjs().startOf('day').toDate()

    //Create an habit in habit model with title, created_at and weekday
    await prisma.habit.create({
      data:{
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map(weekDay =>{
            return {
              week_day: weekDay
            }
          })
        }
      }
    })

  })

  //Get day information by HTTP method GET, and return possible habits and completed habits for this day
  app.get('/day', async(request) => {
    // Get params of the day using zod lib object
    const getDayParams = z.object({
      date: z.coerce.date()
    })
    // Parse the date with query of request
    const { date } = getDayParams.parse(request.query)
    //Use startOf method of dayjs lib to delimit hour 00:00:00 for the habit
    const parsedDate = dayjs(date).startOf('day')
    const weekDay = parsedDate.get('day')
    // Find possible habits for the day in question in the habit model
    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at:{
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          }
        }
      }
    })

    const day = await prisma.day.findFirst({
      where: {
        date: parsedDate.toDate(),
      },
      include:  {
        dayHabits: true,
      }
    })

    const completedHabits = day?.dayHabits.map(dayHabit =>{
      return dayHabit.habit_id
    }) ?? []

    return {
      possibleHabits,
      completedHabits
    }
  })


  //Manipulate habits completion
  app.patch('/habits/:id/toggle', async (request) => {

    const toogleHabitParams = z.object({
      id: z.string().uuid(),
    })

    const { id } = toogleHabitParams.parse(request.params)

    const today = dayjs().startOf('day').toDate()

    let day = await prisma.day.findUnique({
      where:{
        date: today,
      }
    })

    if(!day){
      day = await prisma.day.create({
        data:{
          date: today
        }
      })
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where:{
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        }
      }
    })

    if(dayHabit){
      // Remove habit marked as complete
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      })
    } else {
        //Complete the habit
      await prisma.dayHabit.create({
        data:{
          day_id: day.id,
          habit_id: id,
        }
      })
    }
  })


  //Return a summary of days and completed habits
  app.get('/summary', async () => {
    //Query writed in RAW mode, specific to run in SQLite 

    const summary = await prisma.$queryRaw`
    SELECT
      D.id,
      D.date,
        (
          SELECT
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H
            ON H.id = HWD.habit_id
          WHERE
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.created_at <= D.date
        ) as amount
    FROM days D
    `
    return summary
  })

}